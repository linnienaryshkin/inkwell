"""Chat assistant endpoints with in-memory thread storage and LangGraph backend."""

import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Cookie, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.graph import graph
from app.models.chat import ChatResponse, Message, MessageCreate, Thread, ThreadCreate, ThreadDetail

# In-memory thread store: key = (user_login, thread_id), value = Thread with history
# We also maintain a list of threads per user for quick listing
_threads: dict[
    tuple[str, str], dict
] = {}  # (user, thread_id) -> {thread: Thread, history: list[Message]}
_user_threads: dict[str, list[str]] = {}  # user_login -> list of thread_ids

router = APIRouter()


async def get_user_login(gh_access_token: str) -> str:
    """Fetch the authenticated user's login from GitHub API.

    Args:
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        str: GitHub user login.

    Raises:
        HTTPException: 401 if the token is invalid or 502 if GitHub API fails.
    """
    async with httpx.AsyncClient() as http:
        try:
            resp = await http.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {gh_access_token}"},
            )
            resp.raise_for_status()
            return resp.json()["login"]
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=401, detail="Invalid access token")
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="GitHub API error")


@router.get("/threads", response_model=list[Thread])
async def list_threads(
    gh_access_token: str | None = Cookie(default=None),
) -> list[Thread]:
    """List all chat threads for the current user.

    Args:
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        list[Thread]: All threads for the current user.

    Raises:
        HTTPException: 401 if not authenticated.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_login = await get_user_login(gh_access_token)
    thread_ids = _user_threads.get(user_login, [])
    threads = []
    for thread_id in thread_ids:
        key = (user_login, thread_id)
        if key in _threads:
            threads.append(_threads[key]["thread"])
    return threads


@router.post("/threads", response_model=Thread)
async def create_thread(
    req: ThreadCreate,
    gh_access_token: str | None = Cookie(default=None),
) -> Thread:
    """Create a new thread with an initial message.

    The initial message is sent to the graph, and the thread is created with the response.

    Args:
        req: Request body with content and article_content.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        Thread: Newly created thread.

    Raises:
        HTTPException: 401 if not authenticated.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_login = await get_user_login(gh_access_token)
    thread_id = str(uuid.uuid4())

    # Build system prompt
    system_prompt = (
        "You are a co-writer assistant. The article the user is working on:\n\n"
        "---\n"
        f"{req.article_content}\n"
        "---\n\n"
        "Help the user improve, expand, or discuss this article."
    )

    # Invoke the graph with the initial message
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=req.content)]
    result = graph.invoke(
        {"messages": messages},
        config={"configurable": {"thread_id": thread_id}},
    )

    # Extract AI response
    ai_message = result["messages"][-1]
    reply = ai_message.content

    # Create thread title from first message
    title = req.content[:60]
    if len(req.content) > 60:
        title += "..."

    # Create thread and store
    thread = Thread(
        thread_id=thread_id,
        title=title,
        created_at=datetime.now(UTC).isoformat(),
    )

    history = [
        Message(role="human", content=req.content),
        Message(role="ai", content=reply),
    ]

    key = (user_login, thread_id)
    _threads[key] = {"thread": thread, "history": history}

    if user_login not in _user_threads:
        _user_threads[user_login] = []
    _user_threads[user_login].append(thread_id)

    return thread


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
async def get_thread(
    thread_id: str,
    gh_access_token: str | None = Cookie(default=None),
) -> ThreadDetail:
    """Get a thread with its full message history.

    Args:
        thread_id: ID of the thread to retrieve.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        ThreadDetail: Thread with full history.

    Raises:
        HTTPException: 401 if not authenticated; 404 if thread not found.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_login = await get_user_login(gh_access_token)
    key = (user_login, thread_id)

    if key not in _threads:
        raise HTTPException(status_code=404, detail="Thread not found")

    data = _threads[key]
    thread = data["thread"]
    history = data["history"]

    return ThreadDetail(
        thread_id=thread.thread_id,
        title=thread.title,
        created_at=thread.created_at,
        history=history,
    )


@router.post("/threads/{thread_id}/messages", response_model=ChatResponse)
async def send_message(
    thread_id: str,
    req: MessageCreate,
    gh_access_token: str | None = Cookie(default=None),
) -> ChatResponse:
    """Send a message to an existing thread and receive AI response.

    Args:
        thread_id: ID of the thread to message.
        req: Request body with content and article_content.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        ChatResponse: The AI's reply and full thread history.

    Raises:
        HTTPException: 401 if not authenticated; 404 if thread not found.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_login = await get_user_login(gh_access_token)
    key = (user_login, thread_id)

    if key not in _threads:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Build system prompt
    system_prompt = (
        "You are a co-writer assistant. The article the user is working on:\n\n"
        "---\n"
        f"{req.article_content}\n"
        "---\n\n"
        "Help the user improve, expand, or discuss this article."
    )

    # Invoke graph with new message
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=req.content)]
    result = graph.invoke(
        {"messages": messages},
        config={"configurable": {"thread_id": thread_id}},
    )

    # Extract AI response
    ai_message = result["messages"][-1]
    reply = ai_message.content

    # Update thread history
    data = _threads[key]
    history = data["history"]
    history.append(Message(role="human", content=req.content))
    history.append(Message(role="ai", content=reply))

    return ChatResponse(
        thread_id=thread_id,
        reply=reply,
        history=history,
    )
