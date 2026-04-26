from typing import Literal

from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Request body for sending a chat message."""

    message: str


class ThreadPreview(BaseModel):
    """Preview of a chat thread."""

    thread_id: str
    preview: str


# TODO: Instead of this custom class of message, I would like to reuse message type from langgraph... And let FE deal with how to display it...
class ChatMessage(BaseModel):
    """A single message in a chat thread."""

    role: Literal["user", "assistant"]
    content: str


class ThreadDetail(BaseModel):
    """Full detail of a chat thread including message history."""

    thread_id: str
    preview: str
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    """Response containing thread ID and AI reply."""

    thread_id: str
    reply: str
