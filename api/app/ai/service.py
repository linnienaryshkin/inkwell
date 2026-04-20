"""Chat assistant AI service — handles prompt building and graph invocation."""

from datetime import UTC, datetime

from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.graph import graph
from app.models.chat import Message, Thread


def build_system_prompt() -> str:
    """Build the system prompt for the co-writer assistant.

    Returns:
        str: System prompt instructing Claude to assist with article writing.
    """
    return (
        "You are a helpful co-writer assistant. Assist the user in improving, "
        "expanding, and discussing their article. Provide constructive feedback "
        "and suggestions while maintaining a supportive tone."
    )


def invoke_thread(
    thread_id: str,
    user_message: str,
    is_new: bool = False,
) -> tuple[str, list[Message]]:
    """Invoke the LangGraph to generate a response and return updated history.

    Args:
        thread_id: UUID of the thread for checkpoint restoration.
        user_message: The user's input message.
        is_new: If True, prepend the system prompt (new thread). Otherwise, use existing history.

    Returns:
        tuple: (ai_response, updated_message_history) where history is the full
               conversation history for the thread.

    Raises:
        Exception: If graph invocation or message extraction fails.
    """
    messages = []

    # For new threads, include the system prompt
    if is_new:
        messages.append(SystemMessage(content=build_system_prompt()))

    messages.append(HumanMessage(content=user_message))

    # Invoke the graph with the thread_id as checkpoint key
    result = graph.invoke(
        {"messages": messages},
        config={"configurable": {"thread_id": thread_id}},
    )

    # Extract the AI's last response from the result
    result_messages = result.get("messages", [])
    if not result_messages:
        raise ValueError("Graph invocation returned empty message list")

    ai_response = result_messages[-1].content
    if not ai_response:
        raise ValueError("AI response is empty")

    # Build full history: all messages except the system prompt
    history = [
        Message(
            role="human" if msg.__class__.__name__ == "HumanMessage" else "ai",
            content=msg.content,
        )
        for msg in result_messages
        if msg is not None and msg.__class__.__name__ != "SystemMessage"
    ]

    return ai_response, history


def create_thread_metadata(user_message: str) -> Thread:
    """Create thread metadata from the initial user message.

    Args:
        user_message: The initial message content.

    Returns:
        Thread: Thread metadata (title truncated to 60 chars, timestamp).
    """
    title = user_message[:60]
    if len(user_message) > 60:
        title += "..."

    return Thread(
        thread_id="",  # Will be set by the router
        title=title,
        created_at=datetime.now(UTC).isoformat(),
    )
