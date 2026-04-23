from typing import Literal

from pydantic import BaseModel


class ChatMessage(BaseModel):
    """A single message in a chat thread."""

    role: Literal["user", "assistant"]
    content: str
    created_at: str


class ChatThread(BaseModel):
    """A chat thread scoped to a user and article."""

    id: str
    slug: str
    title: str
    created_at: str
    messages: list[ChatMessage] = []


class ThreadMeta(BaseModel):
    """Thread summary returned in GET /ai/threads list."""

    id: str
    slug: str
    title: str
    created_at: str


class CreateThreadRequest(BaseModel):
    """POST /ai/threads body — creates thread with first message."""

    slug: str
    message: str
    article_content: str


class CreateThreadResponse(BaseModel):
    """Response from POST /ai/threads."""

    thread_id: str
    reply: str


class PostMessageRequest(BaseModel):
    """POST /ai/threads/{id} body — adds a message to existing thread."""

    message: str
    article_content: str


class PostMessageResponse(BaseModel):
    """Response from POST /ai/threads/{id}."""

    reply: str
