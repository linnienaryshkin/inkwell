from typing import Literal

from pydantic import BaseModel

# TODO: Add documentation to the models and their fields


class ArticleVersion(BaseModel):
    sha: str
    message: str
    committed_at: str  # ISO 8601 timestamp


class ArticleSummary(BaseModel):
    slug: str
    title: str
    status: Literal["draft", "published"]
    tags: list[str]


class ArticleMeta(BaseModel):
    title: str
    status: Literal["draft", "published"]
    tags: list[str]


class Article(BaseModel):
    slug: str
    title: str
    status: Literal["draft", "published"]
    content: str
    tags: list[str]
    versions: list[ArticleVersion] = []


class ArticlePatch(BaseModel):
    title: str | None = None
    status: Literal["draft", "published"] | None = None
    content: str | None = None
    tags: list[str] | None = None
