from fastapi import APIRouter, Depends, HTTPException, status

from app.ai.service import add_message, create_thread, list_threads
from app.models.ai import ChatRequest, ChatResponse, ThreadPreview
from app.routers.articles import require_auth

router = APIRouter()


@router.get("/threads", response_model=list[ThreadPreview])
async def get_threads(current_user: str = Depends(require_auth)) -> list[ThreadPreview]:
    """List all chat threads."""
    return list_threads()


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
        return create_thread(request.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get AI response",
        )


@router.post("/threads/{thread_id}", response_model=ChatResponse)
async def send_message_to_thread(
    thread_id: str,
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
        return add_message(thread_id, request.message)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread {thread_id} not found",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get AI response",
        )
