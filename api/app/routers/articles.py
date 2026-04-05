import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException

from app.github_articles import (
    get_article as gh_get_article,
)
from app.github_articles import (
    list_article_metas,
)
from app.models.article import Article, ArticleMeta

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
