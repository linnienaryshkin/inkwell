"""MCP tool handlers — async functions that call github_articles.py services."""

import httpx

from app.github_articles import (
    create_article,
    delete_article,
    get_article,
    list_article_metas,
    save_article,
)
from app.models.article import Article, ArticleMeta


async def handle_list_articles(access_token: str) -> list[ArticleMeta]:
    """Handler for list_articles tool.

    Fetches all article metadata from GitHub for the authenticated user.

    Args:
        access_token: GitHub access token for API authentication.

    Returns:
        list[ArticleMeta]: List of all article metadata summaries.

    Raises:
        ValueError: On invalid token, GitHub API errors, or malformed data.
    """
    try:
        return await list_article_metas(access_token)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise ValueError("Invalid GitHub token") from e
        elif e.response.status_code == 502:
            raise ValueError("GitHub API error: 502") from e
        raise ValueError(f"GitHub API error: {e.response.status_code}") from e
    except Exception as e:
        raise ValueError(f"Failed to fetch articles: {str(e)}") from e


async def handle_get_article(access_token: str, slug: str) -> Article:
    """Handler for get_article tool.

    Fetches a full article including content and commit history from GitHub.

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).

    Returns:
        Article: Full article with metadata, content, and version history.

    Raises:
        ValueError: On invalid token, missing article, GitHub API errors, or malformed data.
    """
    try:
        return await get_article(access_token, slug)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise ValueError("Invalid GitHub token") from e
        elif e.response.status_code == 404:
            raise ValueError("Article not found") from e
        elif e.response.status_code == 502:
            raise ValueError("GitHub API error: 502") from e
        raise ValueError(f"GitHub API error: {e.response.status_code}") from e
    except Exception as e:
        raise ValueError(f"Failed to fetch article: {str(e)}") from e


async def handle_create_article(
    access_token: str, title: str, slug: str, tags: list[str], content: str
) -> Article:
    """Handler for create_article tool.

    Creates a new article with metadata and initial content in a single commit.

    Args:
        access_token: GitHub access token for API authentication.
        title: Article title.
        slug: Article slug (becomes directory name).
        tags: List of article tags.
        content: Initial markdown content.

    Returns:
        Article: The newly created article with full metadata and history.

    Raises:
        ValueError: On invalid token, slug conflict, GitHub API errors, or invalid data.
    """
    try:
        return await create_article(access_token, title, slug, tags, content)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise ValueError("Invalid GitHub token") from e
        elif e.response.status_code == 409:
            raise ValueError(f"Article with slug '{slug}' already exists") from e
        elif e.response.status_code == 502:
            raise ValueError("GitHub API error: 502") from e
        raise ValueError(f"GitHub API error: {e.response.status_code}") from e
    except Exception as e:
        raise ValueError(f"Failed to create article: {str(e)}") from e


async def handle_save_article(
    access_token: str,
    slug: str,
    title: str,
    tags: list[str],
    content: str,
    message: str | None,
) -> Article:
    """Handler for save_article tool.

    Updates an existing article's metadata and content in a single commit.

    Args:
        access_token: GitHub access token for API authentication.
        slug: Article slug (directory name).
        title: Updated article title.
        tags: Updated article tags.
        content: Updated markdown content.
        message: Commit message (optional, generated if not provided).

    Returns:
        Article: The updated article with full metadata and history.

    Raises:
        ValueError: On invalid token, missing article, GitHub API errors, or invalid data.
    """
    try:
        return await save_article(
            access_token, slug, title, tags, content, message or f"update {slug}"
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise ValueError("Invalid GitHub token") from e
        elif e.response.status_code == 404:
            raise ValueError("Article not found") from e
        elif e.response.status_code == 502:
            raise ValueError("GitHub API error: 502") from e
        raise ValueError(f"GitHub API error: {e.response.status_code}") from e
    except Exception as e:
        raise ValueError(f"Failed to save article: {str(e)}") from e


async def handle_delete_article(access_token: str, slug: str) -> None:
    """Handler for delete_article tool.

    Deletes an article's meta.json and content.md from GitHub.

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).

    Returns:
        None

    Raises:
        ValueError: On invalid token, missing article, or GitHub API errors.
    """
    try:
        await delete_article(access_token, slug)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise ValueError("Invalid GitHub token") from e
        elif e.response.status_code == 404:
            raise ValueError("Article not found") from e
        elif e.response.status_code == 502:
            raise ValueError("GitHub API error: 502") from e
        raise ValueError(f"GitHub API error: {e.response.status_code}") from e
    except Exception as e:
        raise ValueError(f"Failed to delete article: {str(e)}") from e
