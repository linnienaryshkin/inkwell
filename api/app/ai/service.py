import asyncio
import uuid

from langchain_core.messages import HumanMessage

from app.ai.graph import checkpointer, graph
from app.models.ai import ChatMessage, ChatResponse, ThreadDetail, ThreadPreview


def _preview_from_state(thread_id: str) -> str:
    """Extract the first human message content as the thread preview.

    Args:
        thread_id: The UUID of the thread.

    Returns:
        str: Content of the first HumanMessage, or empty string if none found.
    """
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)
    if state and state.values:
        for msg in state.values.get("messages", []):
            if type(msg).__name__ == "HumanMessage" and hasattr(msg, "content"):
                return msg.content
    return ""


def list_threads() -> list[ThreadPreview]:
    """List all threads with their previews.

    Returns:
        list[ThreadPreview]: All threads stored in the checkpointer, deduplicated by thread_id.
    """
    seen: set[str] = set()
    result: list[ThreadPreview] = []

    for checkpoint_tuple in checkpointer.list(config=None):
        thread_id = checkpoint_tuple.config["configurable"]["thread_id"]
        if thread_id in seen:
            continue
        seen.add(thread_id)
        result.append(ThreadPreview(thread_id=thread_id, preview=_preview_from_state(thread_id)))

    return result


def get_thread(thread_id: str) -> ThreadDetail:
    """Return full message history for a thread.

    Reads messages from the LangGraph checkpoint for the given thread.

    Args:
        thread_id: The UUID of the thread to retrieve.

    Returns:
        ThreadDetail: Thread metadata and ordered message history.

    Raises:
        KeyError: When thread_id is not found in the checkpointer.
    """
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)

    if not state or not state.values:
        raise KeyError(f"Thread {thread_id} not found")

    messages: list[ChatMessage] = []
    for msg in state.values.get("messages", []):
        msg_type = type(msg).__name__
        raw = msg.content if hasattr(msg, "content") else str(msg)
        if isinstance(raw, list):
            content = "".join(b.get("text", "") for b in raw if isinstance(b, dict))
        else:
            content = raw
        if msg_type == "HumanMessage":
            messages.append(ChatMessage(role="user", content=content))
        elif msg_type in ("AIMessage", "AIMessageChunk"):
            messages.append(ChatMessage(role="assistant", content=content))

    preview = _preview_from_state(thread_id)
    return ThreadDetail(thread_id=thread_id, preview=preview, messages=messages)


async def create_thread(message: str) -> ChatResponse:
    """Create a new thread and send the first message."""
    thread_id = str(uuid.uuid4())

    try:
        reply = await _invoke_graph(thread_id, message)
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Graph invocation failed: {e}", exc_info=True)
        raise
    return ChatResponse(thread_id=thread_id, reply=reply)


async def add_message(thread_id: str, message: str) -> ChatResponse:
    """Add a message to an existing thread.

    Args:
        thread_id: The UUID of the thread to add the message to.
        message: The user message content.

    Returns:
        ChatResponse: The thread ID and assistant reply.

    Raises:
        KeyError: When thread_id is not found in the checkpointer.
    """
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)
    if not state or not state.values:
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
    loop = asyncio.get_running_loop()
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
