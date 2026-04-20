"""Chat assistant data models."""

from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    """A single message in the chat history."""

    role: Literal["human", "ai"]
    content: str


class Thread(BaseModel):
    """A chat thread scoped to a user and article."""

    thread_id: str = Field(..., description="UUID of the thread")
    article_slug: str
    title: str = Field(..., description="First user message, truncated to 60 chars")
    created_at: str = Field(..., description="ISO 8601 timestamp")


class ThreadCreate(BaseModel):
    """Request to create a new thread."""

    article_slug: str


class MessageCreate(BaseModel):
    """Request to send a message to a thread."""

    content: str
    article_content: str = Field(..., description="Current article content for system prompt")


class ChatResponse(BaseModel):
    """Response after sending a message."""

    thread_id: str
    reply: str = Field(..., description="The AI's response")
    history: list[Message] = Field(..., description="Full message history for the thread")
