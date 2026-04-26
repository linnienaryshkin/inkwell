import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.ai.service import add_message, create_thread, get_thread, list_threads
from app.models.ai import ChatRequest, ChatResponse, ThreadDetail, ThreadPreview
from app.shared.auth import require_auth

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/threads", response_model=list[ThreadPreview])
async def get_threads(current_user: str = Depends(require_auth)) -> list[ThreadPreview]:
    """List all chat threads."""
    return list_threads()


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
async def get_thread_detail(
    thread_id: uuid.UUID,
    current_user: str = Depends(require_auth),
) -> ThreadDetail:
    """Return full message history for a thread.

    Args:
        thread_id: The UUID of the thread to retrieve.
        current_user: Authenticated GitHub username from session cookie.

    Returns:
        ThreadDetail: Thread metadata and ordered message history.

    Raises:
        HTTPException: 404 if thread_id is not found.
    """
    try:
        return get_thread(str(thread_id))
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread {thread_id} not found",
        )


@router.post("/threads", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_new_thread(
    request: ChatRequest,
    current_user: str = Depends(require_auth),
) -> ChatResponse:
    """Create a new chat thread with an initial message."""
    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be empty",
        )

    try:
        return await create_thread(request.message)
    except Exception as e:
        logger.error(f"Failed to create thread: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get AI response",
        )


@router.post("/threads/{thread_id}", response_model=ChatResponse)
async def send_message_to_thread(
    thread_id: uuid.UUID,
    request: ChatRequest,
    current_user: str = Depends(require_auth),
) -> ChatResponse:
    """Send a message to an existing chat thread."""
    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be empty",
        )

    try:
        return await add_message(str(thread_id), request.message)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread {str(thread_id)} not found",
        )
    except Exception as e:
        logger.error(f"Failed to send message to thread {str(thread_id)}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get AI response",
        )
