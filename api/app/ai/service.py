import asyncio
import uuid

from app.ai.graph import graph
from app.models.ai import ChatResponse, ThreadPreview

_threads: dict[str, dict] = {}


def list_threads() -> list[ThreadPreview]:
    """List all threads with their previews."""
    return [
        ThreadPreview(thread_id=thread_id, preview=thread_data["preview"])
        for thread_id, thread_data in _threads.items()
    ]


def create_thread(message: str) -> ChatResponse:
    """Create a new thread and send the first message."""
    thread_id = str(uuid.uuid4())
    _threads[thread_id] = {"preview": message}

    # Invoke graph asynchronously to avoid blocking
    reply = asyncio.run(_invoke_graph(thread_id, message))
    return ChatResponse(thread_id=thread_id, reply=reply)


def add_message(thread_id: str, message: str) -> ChatResponse:
    """Add a message to an existing thread."""
    if thread_id not in _threads:
        raise KeyError(f"Thread {thread_id} not found")

    reply = asyncio.run(_invoke_graph(thread_id, message))
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
        {"messages": [{"role": "user", "content": message}]},
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
