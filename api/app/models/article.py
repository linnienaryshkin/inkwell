from typing import Literal

from pydantic import BaseModel


class ArticleVersion(BaseModel):
    """Git commit metadata for an article version."""

    sha: str
    message: str
    committed_at: str  # ISO 8601 timestamp


class ArticleMeta(BaseModel):
    """Article metadata summary returned in list endpoints."""

    slug: str
    title: str
    status: Literal["draft", "published"]
    tags: list[str]


class Article(BaseModel):
    """Full article with content and version history returned by /articles/{slug}."""

    slug: str
    content: str
    meta: ArticleMeta
    versions: list[ArticleVersion] = []


class ArticlePatch(BaseModel):
    """Partial article update schema for PATCH /articles/{slug}. All fields optional."""

    title: str | None = None
    status: Literal["draft", "published"] | None = None
    content: str | None = None
    tags: list[str] | None = None


class ArticleCreate(BaseModel):
    """Request schema for POST /articles to create a new article."""

    title: str
    slug: str
    tags: list[str] = []
    content: str = ""


class ArticleSave(BaseModel):
    """Full article save for PATCH /articles/{slug}. All fields required except optional commit message."""

    title: str
    tags: list[str]
    content: str
    message: str | None = None
