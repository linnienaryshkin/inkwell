from typing import Literal

from pydantic import BaseModel


class ArticleVersion(BaseModel):
    sha: str
    message: str
    committed_at: str  # ISO 8601 timestamp


class ArticleMeta(BaseModel):
    slug: str
    title: str
    status: Literal["draft", "published"]
    tags: list[str]


class Article(BaseModel):
    slug: str
    content: str
    meta: ArticleMeta
    versions: list[ArticleVersion] = []


class ArticlePatch(BaseModel):
    title: str | None = None
    status: Literal["draft", "published"] | None = None
    content: str | None = None
    tags: list[str] | None = None


class ArticleCreate(BaseModel):
    title: str
    slug: str
    tags: list[str] = []
    content: str = ""


class ArticleSave(BaseModel):
    title: str
    tags: list[str]
    content: str
    message: str | None = None
