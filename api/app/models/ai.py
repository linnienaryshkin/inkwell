from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Request body for sending a chat message."""

    message: str


class ThreadPreview(BaseModel):
    """Preview of a chat thread."""

    thread_id: str
    preview: str


class ChatResponse(BaseModel):
    """Response containing thread ID and AI reply."""

    thread_id: str
    reply: str
