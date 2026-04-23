import hashlib
import uuid
from datetime import UTC, datetime

from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.graph import graph
from app.models.chat import (
    ChatMessage,
    ChatThread,
    CreateThreadResponse,
    PostMessageResponse,
    ThreadMeta,
)

# Module-level in-memory thread storage
_threads: dict[str, ChatThread] = {}


def _token_key(token: str) -> str:
    """Return a short hash of the token used as a namespace key.

    Args:
        token: GitHub access token.

    Returns:
        str: First 16 characters of the SHA256 hex hash of the token.
    """
    return hashlib.sha256(token.encode()).hexdigest()[:16]


def _now_iso() -> str:
    """Get current timestamp in ISO 8601 format.

    Returns:
        str: Current UTC timestamp as ISO 8601 string.
    """
    return datetime.now(UTC).isoformat()


def _make_system_prompt(article_content: str) -> str:
    """Create the system prompt for the cowriter assistant.

    Args:
        article_content: The current article content.

    Returns:
        str: System prompt with injected article context.
    """
    return f"""You are a writing cowriter assistant for the article below.
Help the author improve, expand, or discuss their work.

--- ARTICLE CONTENT ---
{article_content}
--- END ARTICLE ---"""


async def list_threads(token: str, slug: str) -> list[ThreadMeta]:
    """List all threads for a given article, filtered by authenticated user.

    Args:
        token: GitHub access token for user identification.
        slug: Article slug to filter threads.

    Returns:
        list[ThreadMeta]: List of thread summaries, sorted by created_at descending.
    """
    token_ns = _token_key(token)
    results = []
    for thread in _threads.values():
        # Thread ID encodes the token namespace; reconstruct to check ownership
        if thread.id.startswith(token_ns) and thread.slug == slug:
            results.append(
                ThreadMeta(
                    id=thread.id,
                    slug=thread.slug,
                    title=thread.title,
                    created_at=thread.created_at,
                )
            )
    # Sort by created_at descending
    results.sort(key=lambda t: t.created_at, reverse=True)
    return results


async def create_thread(
    token: str, slug: str, message: str, article_content: str
) -> CreateThreadResponse:
    """Create a new chat thread and send the first message.

    Args:
        token: GitHub access token for user identification.
        slug: Article slug.
        message: First user message.
        article_content: Current article content to include in system context.

    Returns:
        CreateThreadResponse: New thread ID and assistant's reply.

    Raises:
        ValueError: If message is empty.
    """
    if not message or not message.strip():
        raise ValueError("Message cannot be empty")

    # Generate thread ID with token namespace prefix
    token_ns = _token_key(token)
    thread_id = f"{token_ns}_{uuid.uuid4().hex[:8]}"
    now = _now_iso()

    # Create thread and invoke LangGraph
    system_prompt = _make_system_prompt(article_content)
    user_msg = HumanMessage(content=message)
    result = graph.invoke(
        {"messages": [SystemMessage(content=system_prompt), user_msg]},
        config={"configurable": {"thread_id": thread_id}},
    )
    assistant_reply = result["messages"][-1].content

    # Store thread with both messages
    thread = ChatThread(
        id=thread_id,
        slug=slug,
        title=message[:60],  # Truncate to 60 chars for title
        created_at=now,
        messages=[
            ChatMessage(role="user", content=message, created_at=now),
            ChatMessage(role="assistant", content=assistant_reply, created_at=now),
        ],
    )
    _threads[thread_id] = thread

    return CreateThreadResponse(thread_id=thread_id, reply=assistant_reply)


async def post_message(thread_id: str, message: str, article_content: str) -> PostMessageResponse:
    """Post a new message to an existing thread.

    Args:
        thread_id: ID of the thread to post to.
        message: User message content.
        article_content: Current article content to include in system context.

    Returns:
        PostMessageResponse: Assistant's reply.

    Raises:
        ValueError: If thread not found or message is empty.
    """
    if not message or not message.strip():
        raise ValueError("Message cannot be empty")

    if thread_id not in _threads:
        raise ValueError("Thread not found")

    thread = _threads[thread_id]
    now = _now_iso()

    # Append user message
    user_msg = ChatMessage(role="user", content=message, created_at=now)
    thread.messages.append(user_msg)

    # Invoke LangGraph with existing thread_id (maintains checkpointer state)
    system_prompt = _make_system_prompt(article_content)
    result = graph.invoke(
        {
            "messages": [
                SystemMessage(content=system_prompt),
                HumanMessage(content=message),
            ]
        },
        config={"configurable": {"thread_id": thread_id}},
    )
    assistant_reply = result["messages"][-1].content

    # Append assistant message
    assistant_msg = ChatMessage(role="assistant", content=assistant_reply, created_at=now)
    thread.messages.append(assistant_msg)

    return PostMessageResponse(reply=assistant_reply)
