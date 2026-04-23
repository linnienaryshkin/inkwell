import re

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.github_articles import (
    create_article as gh_create_article,
)
from app.github_articles import (
    delete_article as gh_delete_article,
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
from app.routers.deps import require_auth

router = APIRouter()


@router.get("", response_model=list[ArticleMeta])
async def list_articles(
    access_token: str = Depends(require_auth),
) -> list[ArticleMeta]:
    """List all articles for the authenticated user.

    Args:
        access_token: GitHub access token from authentication dependency.

    Returns:
        list[ArticleMeta]: List of article metadata summaries.

    Raises:
        HTTPException: 401 if not authenticated, 502 on GitHub API error.
    """
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
    """Retrieve a full article by slug including content and version history.

    Args:
        slug: The article slug (alphanumeric with hyphens).
        access_token: GitHub access token from authentication dependency.

    Returns:
        Article: Full article with metadata, content, and version history.

    Raises:
        HTTPException: 401 if not authenticated, 404 if article not found, 502 on GitHub API error.
    """
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
    """Create a new article with metadata and initial content.

    Args:
        body: Request body containing title, slug, tags, and content.
        access_token: GitHub access token from authentication dependency.

    Returns:
        Article: The newly created article (status 201).

    Raises:
        HTTPException: 401 if not authenticated, 409 if slug already exists, 422 on validation error,
            502 on GitHub API error.
    """
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
    """Update an existing article's metadata and content.

    Args:
        slug: The article slug to update.
        body: Request body containing title, tags, content, and optional commit message.
        access_token: GitHub access token from authentication dependency.

    Returns:
        Article: The updated article.

    Raises:
        HTTPException: 401 if not authenticated, 404 if article not found, 422 on validation error,
            502 on GitHub API error.
    """
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$", slug):
        raise HTTPException(
            status_code=422, detail="Slug must be lowercase alphanumeric with hyphens"
        )
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


@router.delete("/{slug}", status_code=204)
async def delete_article_endpoint(
    slug: str,
    access_token: str = Depends(require_auth),
) -> None:
    """Delete an article and all its associated files.

    Args:
        slug: The article slug to delete.
        access_token: GitHub access token from authentication dependency.

    Returns:
        None

    Raises:
        HTTPException: 401 if not authenticated, 404 if article not found, 422 on validation error,
            502 on GitHub API error.
    """
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$", slug):
        raise HTTPException(
            status_code=422, detail="Slug must be lowercase alphanumeric with hyphens"
        )
    try:
        await gh_delete_article(access_token, slug)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Article not found")
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e.response.status_code}")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to delete article on GitHub")
