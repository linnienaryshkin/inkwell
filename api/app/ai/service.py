import asyncio
import uuid

from langchain_core.messages import HumanMessage

from app.ai.graph import graph
from app.models.ai import ChatMessage, ChatResponse, ThreadDetail, ThreadPreview

_threads: dict[str, dict] = {}


def list_threads() -> list[ThreadPreview]:
    """List all threads with their previews."""
    return [
        ThreadPreview(thread_id=thread_id, preview=thread_data["preview"])
        for thread_id, thread_data in _threads.items()
    ]


def get_thread(thread_id: str) -> ThreadDetail:
    """Return full message history for a thread.

    Reads messages from the LangGraph checkpoint for the given thread.

    Args:
        thread_id: The UUID of the thread to retrieve.

    Returns:
        ThreadDetail: Thread metadata and ordered message history.

    Raises:
        KeyError: When thread_id is not found in the store.
    """
    if thread_id not in _threads:
        raise KeyError(f"Thread {thread_id} not found")

    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)

    messages: list[ChatMessage] = []
    if state and state.values:
        for msg in state.values.get("messages", []):
            msg_type = type(msg).__name__
            content = msg.content if hasattr(msg, "content") else str(msg)
            if msg_type == "HumanMessage":
                messages.append(ChatMessage(role="user", content=content))
            elif msg_type in ("AIMessage", "AIMessageChunk"):
                messages.append(ChatMessage(role="assistant", content=content))

    return ThreadDetail(
        thread_id=thread_id,
        preview=_threads[thread_id]["preview"],
        messages=messages,
    )


async def create_thread(message: str) -> ChatResponse:
    """Create a new thread and send the first message."""
    thread_id = str(uuid.uuid4())
    _threads[thread_id] = {"preview": message}

    try:
        reply = await _invoke_graph(thread_id, message)
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Graph invocation failed: {e}", exc_info=True)
        raise
    return ChatResponse(thread_id=thread_id, reply=reply)


async def add_message(thread_id: str, message: str) -> ChatResponse:
    """Add a message to an existing thread."""
    if thread_id not in _threads:
        raise KeyError(f"Thread {thread_id} not found")

    try:
        reply = await _invoke_graph(thread_id, message)
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Graph invocation failed for thread {thread_id}: {e}", exc_info=True)
        raise
    return ChatResponse(thread_id=thread_id, reply=reply)


async def _invoke_graph(thread_id: str, message: str) -> str:
    """Invoke the graph in a thread pool to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        _sync_invoke_graph,
        thread_id,
        message,
    )
    return result


def _sync_invoke_graph(thread_id: str, message: str) -> str:
    """Synchronous graph invocation."""
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke(
        {"messages": [HumanMessage(content=message)]},
        config=config,
    )
    # Extract the assistant's reply from the result
    messages = result.get("messages", [])
    if messages:
        last_message = messages[-1]
        if hasattr(last_message, "content"):
            return last_message.content
        elif isinstance(last_message, dict):
            return last_message.get("content", "")
    return ""
