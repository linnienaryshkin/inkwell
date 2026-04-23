from fastapi import APIRouter, Depends, HTTPException, Query

from app.ai import service
from app.models.chat import (
    CreateThreadRequest,
    CreateThreadResponse,
    PostMessageRequest,
    PostMessageResponse,
    ThreadMeta,
)
from app.routers.deps import require_auth

router = APIRouter()


@router.get("", response_model=list[ThreadMeta])
async def list_threads(
    slug: str = Query(...),
    access_token: str = Depends(require_auth),
) -> list[ThreadMeta]:
    """List all chat threads for a given article.

    Args:
        slug: Article slug to filter threads.
        access_token: GitHub access token from authentication dependency.

    Returns:
        list[ThreadMeta]: List of thread summaries sorted by created_at descending.

    Raises:
        HTTPException: 401 if not authenticated.
    """
    return await service.list_threads(access_token, slug)


@router.post("", response_model=CreateThreadResponse, status_code=201)
async def create_thread(
    body: CreateThreadRequest,
    access_token: str = Depends(require_auth),
) -> CreateThreadResponse:
    """Create a new chat thread with an initial message.

    Args:
        body: Request body with slug, message, and article_content.
        access_token: GitHub access token from authentication dependency.

    Returns:
        CreateThreadResponse: New thread ID and assistant's reply.

    Raises:
        HTTPException: 401 if not authenticated, 422 if message is empty.
    """
    try:
        return await service.create_thread(
            access_token,
            body.slug,
            body.message,
            body.article_content,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{thread_id}", response_model=PostMessageResponse)
async def post_message(
    thread_id: str,
    body: PostMessageRequest,
    access_token: str = Depends(require_auth),
) -> PostMessageResponse:
    """Post a new message to an existing chat thread.

    Args:
        thread_id: ID of the thread to post to.
        body: Request body with message and article_content.
        access_token: GitHub access token from authentication dependency.

    Returns:
        PostMessageResponse: Assistant's reply.

    Raises:
        HTTPException: 401 if not authenticated, 403 if thread belongs to different user,
            404 if thread not found, 422 if message is empty.
    """
    try:
        return await service.post_message(
            thread_id,
            body.message,
            body.article_content,
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Thread not found")
        raise HTTPException(status_code=422, detail=str(e))
