"""Chat assistant endpoints with LangGraph backend."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, HTTPException

from app.ai.graph import memory
from app.ai.service import invoke_thread
from app.models.chat import ChatResponse, Message, MessageCreate, Thread, ThreadCreate, ThreadDetail
from app.shared.middleware import get_authenticated_user_login

# Minimal thread metadata store: only title + created_at for list endpoints
# Keys are composite: (user_login, thread_id)
# MemorySaver stores message history via graph checkpoints
_thread_metadata: dict[tuple[str, str], dict[str, str]] = {}

router = APIRouter()


@router.get("/threads", response_model=list[Thread])
async def list_threads(
    gh_access_token: str | None = Cookie(default=None),
) -> list[Thread]:
    """List all chat threads for the current user.

    Returns thread metadata (title, created_at). Full message history
    is fetched separately via GET /threads/{thread_id}.

    Args:
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        list[Thread]: All threads for the current user.

    Raises:
        HTTPException: 401 if not authenticated.
    """
    user_login = await get_authenticated_user_login(gh_access_token)
    threads = []

    # Iterate metadata store to get all threads for this user
    for (user, thread_id), metadata in _thread_metadata.items():
        if user == user_login:
            threads.append(
                Thread(
                    thread_id=thread_id,
                    title=metadata["title"],
                    created_at=metadata["created_at"],
                )
            )

    return threads


@router.post("/threads", response_model=Thread)
async def create_thread(
    req: ThreadCreate,
    gh_access_token: str | None = Cookie(default=None),
) -> Thread:
    """Create a new thread with an initial message.

    Invokes the LangGraph with the user's message and stores minimal metadata.
    Message history is stored in MemorySaver via the graph.

    Args:
        req: Request body with initial message content.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        Thread: Newly created thread metadata.

    Raises:
        HTTPException: 401 if not authenticated.
    """
    user_login = await get_authenticated_user_login(gh_access_token)
    thread_id = str(uuid.uuid4())
    full_thread_id = f"{user_login}:{thread_id}"

    # Create thread title
    title = req.content[:60]
    if len(req.content) > 60:
        title += "..."

    created_at = datetime.now(UTC).isoformat()

    # Invoke the AI graph for the initial response
    # This creates a checkpoint in MemorySaver
    ai_response, _ = invoke_thread(full_thread_id, req.content, is_new=True)

    # Store minimal metadata (for fast list_threads without iterating MemorySaver)
    key = (user_login, thread_id)
    _thread_metadata[key] = {
        "title": title,
        "created_at": created_at,
    }

    thread = Thread(
        thread_id=thread_id,
        title=title,
        created_at=created_at,
    )

    return thread


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
async def get_thread(
    thread_id: str,
    gh_access_token: str | None = Cookie(default=None),
) -> ThreadDetail:
    """Get a thread with its full message history.

    Message history is fetched from MemorySaver checkpoints created by the graph.
    Metadata (title, created_at) comes from the minimal metadata store.

    Args:
        thread_id: ID of the thread to retrieve.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        ThreadDetail: Thread with full history.

    Raises:
        HTTPException: 401 if not authenticated; 404 if thread not found.
    """
    user_login = await get_authenticated_user_login(gh_access_token)
    key = (user_login, thread_id)

    # Check metadata exists
    if key not in _thread_metadata:
        raise HTTPException(status_code=404, detail="Thread not found")

    metadata = _thread_metadata[key]
    full_thread_id = f"{user_login}:{thread_id}"

    # Fetch messages from MemorySaver
    checkpoint_tuple = memory.get_tuple({"configurable": {"thread_id": full_thread_id}})
    messages = []
    if checkpoint_tuple:
        messages = checkpoint_tuple.checkpoint.get("channel_values", {}).get("messages", [])

    # Convert to Message objects
    history = [
        Message(
            role="human" if msg.__class__.__name__ == "HumanMessage" else "ai",
            content=msg.content,
        )
        for msg in messages
    ]

    return ThreadDetail(
        thread_id=thread_id,
        title=metadata["title"],
        created_at=metadata["created_at"],
        history=history,
    )


@router.post("/threads/{thread_id}/messages", response_model=ChatResponse)
async def send_message(
    thread_id: str,
    req: MessageCreate,
    gh_access_token: str | None = Cookie(default=None),
) -> ChatResponse:
    """Send a message to an existing thread and receive AI response.

    Invokes the graph which updates the MemorySaver checkpoint with new messages.

    Args:
        thread_id: ID of the thread to message.
        req: Request body with message content.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        ChatResponse: The AI's reply and full thread history.

    Raises:
        HTTPException: 401 if not authenticated; 404 if thread not found.
    """
    user_login = await get_authenticated_user_login(gh_access_token)
    key = (user_login, thread_id)
    full_thread_id = f"{user_login}:{thread_id}"

    # Verify thread exists (check metadata)
    if key not in _thread_metadata:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Invoke the AI graph with the new message
    # This updates the MemorySaver checkpoint
    ai_response, _ = invoke_thread(full_thread_id, req.content, is_new=False)

    # Fetch updated history from MemorySaver
    checkpoint_tuple = memory.get_tuple({"configurable": {"thread_id": full_thread_id}})
    messages = []
    if checkpoint_tuple:
        messages = checkpoint_tuple.checkpoint.get("channel_values", {}).get("messages", [])

    # Convert to Message objects
    history = [
        Message(
            role="human" if msg.__class__.__name__ == "HumanMessage" else "ai",
            content=msg.content,
        )
        for msg in messages
    ]

    return ChatResponse(
        thread_id=thread_id,
        reply=ai_response,
        history=history,
    )
