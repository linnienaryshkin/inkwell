import re

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException

from app.github_articles import (
    create_article as gh_create_article,
)
from app.github_articles import (
    get_article as gh_get_article,
)
from app.github_articles import (
    list_article_metas,
)
from app.github_articles import (
    save_article as gh_save_article,
)
from app.models.article import Article, ArticleCreate, ArticleMeta, ArticleSave

router = APIRouter()


def require_auth(gh_access_token: str | None = Cookie(default=None)) -> str:
    """Dependency that enforces authentication via the gh_access_token cookie."""
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return gh_access_token


@router.get("", response_model=list[ArticleMeta])
async def list_articles(
    access_token: str = Depends(require_auth),
) -> list[ArticleMeta]:
    try:
        return await list_article_metas(access_token)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token expired or invalid")
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to fetch articles from GitHub")


@router.get("/{slug}", response_model=Article)
async def get_article_by_slug(
    slug: str,
    access_token: str = Depends(require_auth),
) -> Article:
    try:
        return await gh_get_article(access_token, slug)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Article not found")
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except ValueError:
        raise HTTPException(status_code=502, detail="Malformed article data")


@router.post("", response_model=Article, status_code=201)
async def create_article_endpoint(
    body: ArticleCreate,
    access_token: str = Depends(require_auth),
) -> Article:
    if not body.title.strip():
        raise HTTPException(status_code=422, detail="Title must not be empty")
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$", body.slug):
        raise HTTPException(
            status_code=422, detail="Slug must be lowercase alphanumeric with hyphens"
        )
    try:
        return await gh_create_article(
            access_token, body.title.strip(), body.slug, body.tags, body.content
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 422:
            raise HTTPException(status_code=409, detail=f"Article already exists: {body.slug}")
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to create article on GitHub")


@router.patch("/{slug}", response_model=Article)
async def save_article_endpoint(
    slug: str,
    body: ArticleSave,
    access_token: str = Depends(require_auth),
) -> Article:
    try:
        return await gh_save_article(
            access_token,
            slug,
            body.title,
            body.tags,
            body.content,
            body.message or f"update {slug}",
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Article not found")
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to save article on GitHub")
