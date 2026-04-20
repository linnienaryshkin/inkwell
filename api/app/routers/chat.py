"""Chat assistant endpoints with in-memory thread storage and LangGraph backend."""

import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Cookie, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.graph import graph
from app.models.chat import ChatResponse, Message, MessageCreate, Thread, ThreadCreate

# In-memory thread store: key = (user_login, article_slug), value = list of Thread
_threads: dict[tuple[str, str], list[Thread]] = {}

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
    article_slug: str,
    gh_access_token: str | None = Cookie(default=None),
) -> list[Thread]:
    """List all chat threads for the current user and article.

    Args:
        article_slug: The article being discussed in the threads.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        list[Thread]: Threads for this user+article, ordered by creation time.

    Raises:
        HTTPException: 401 if not authenticated.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_login = await get_user_login(gh_access_token)
    key = (user_login, article_slug)
    return _threads.get(key, [])


@router.post("/threads", response_model=Thread)
async def create_thread(
    req: ThreadCreate,
    gh_access_token: str | None = Cookie(default=None),
) -> Thread:
    """Create a new chat thread scoped to a user and article.

    Args:
        req: Request body with article_slug.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        Thread: Newly created thread.

    Raises:
        HTTPException: 401 if not authenticated.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_login = await get_user_login(gh_access_token)
    key = (user_login, req.article_slug)

    thread = Thread(
        thread_id=str(uuid.uuid4()),
        article_slug=req.article_slug,
        title="",  # Will be set after first message
        created_at=datetime.now(UTC).isoformat(),
    )

    if key not in _threads:
        _threads[key] = []
    _threads[key].append(thread)

    return thread


@router.post("/threads/{thread_id}/messages", response_model=ChatResponse)
async def send_message(
    thread_id: str,
    req: MessageCreate,
    gh_access_token: str | None = Cookie(default=None),
) -> ChatResponse:
    """Send a message to a thread and receive a synchronous AI response.

    The system prompt includes the current article content to ground the AI's responses.

    Args:
        thread_id: ID of the thread to message.
        req: Request body with user message content and current article content.
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        ChatResponse: The AI's reply and full thread history.

    Raises:
        HTTPException: 401 if not authenticated; 404 if thread not found or does not belong to user.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_login = await get_user_login(gh_access_token)

    # Find the thread and verify ownership
    thread = None
    for (login, _article_slug), threads_list in _threads.items():
        if login == user_login:
            for t in threads_list:
                if t.thread_id == thread_id:
                    thread = t
                    break
        if thread:
            break

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Build messages: system prompt + history + new human message
    system_prompt = (
        "You are a co-writer assistant. The article the user is working on:\n\n"
        "---\n"
        f"{req.article_content}\n"
        "---\n\n"
        "Help the user improve, expand, or discuss this article."
    )

    messages = [SystemMessage(content=system_prompt), HumanMessage(content=req.content)]

    # Invoke the LangGraph graph with thread checkpoint
    result = graph.invoke(
        {"messages": messages},
        config={"configurable": {"thread_id": thread_id}},
    )

    # Extract the AI's response (last message in result)
    ai_message = result["messages"][-1]
    reply = ai_message.content

    # Update thread title if it's the first message (currently empty)
    if thread.title == "":
        # Truncate first user message to 60 chars for the title
        title = req.content[:60]
        if len(req.content) > 60:
            title += "..."
        thread.title = title

    # Build history for the response: original messages + new exchange
    history = [
        Message(role="human", content=req.content),
        Message(role="ai", content=reply),
    ]

    return ChatResponse(
        thread_id=thread_id,
        reply=reply,
        history=history,
    )
