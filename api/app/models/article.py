from typing import Literal

from pydantic import BaseModel

# TODO: Add documentation to the models and their fields

class Article(BaseModel):
    slug: str
    title: str
    status: Literal["draft", "published"]
    content: str
    tags: list[str]


class ArticlePatch(BaseModel):
    title: str | None = None
    status: Literal["draft", "published"] | None = None
    content: str | None = None
    tags: list[str] | None = None
