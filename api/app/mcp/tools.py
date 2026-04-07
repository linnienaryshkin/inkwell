"""MCP tool definitions using @mcp.tool decorator.

These tools are registered with the FastMCP server and handle article
management operations (list, get, create, save, delete).
"""

import httpx
from pydantic import Field

from app.github_articles import (
    create_article as create_article_service,
)
from app.github_articles import (
    delete_article as delete_article_service,
)
from app.github_articles import (
    get_article as get_article_service,
)
from app.github_articles import (
    list_article_metas,
)
from app.github_articles import (
    save_article as save_article_service,
)
from app.mcp.server import mcp
from app.models.article import Article, ArticleMeta


@mcp.tool()
def health_check() -> dict:
    """Check if the Inkwell MCP server is up and running.

    Returns:
        dict: Status message indicating the MCP server is operational.
    """
    return {"status": "ok", "message": "Inkwell MCP API server is up"}


@mcp.tool()
async def list_articles(
    access_token: str = Field(description="GitHub access token"),
) -> list[ArticleMeta]:
    """List all articles for the authenticated user.

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


@mcp.tool()
async def get_article(
    access_token: str = Field(description="GitHub access token"),
    slug: str = Field(description="Article slug (directory name)"),
) -> Article:
    """Get a specific article by slug.

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).

    Returns:
        Article: Full article with metadata, content, and version history.

    Raises:
        ValueError: On invalid token, missing article, GitHub API errors, or malformed data.
    """
    try:
        return await get_article_service(access_token, slug)
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


@mcp.tool()
async def create_article(
    access_token: str = Field(description="GitHub access token"),
    title: str = Field(description="Article title"),
    slug: str = Field(description="Article slug (directory name)"),
    tags: list[str] = Field(description="List of article tags"),
    content: str = Field(description="Initial markdown content"),
) -> Article:
    """Create a new article.

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
        return await create_article_service(access_token, title, slug, tags, content)
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


@mcp.tool()
async def save_article(
    access_token: str = Field(description="GitHub access token"),
    slug: str = Field(description="Article slug (directory name)"),
    title: str = Field(description="Updated article title"),
    tags: list[str] = Field(description="Updated article tags"),
    content: str = Field(description="Updated markdown content"),
    message: str | None = Field(default=None, description="Commit message (optional)"),
) -> Article:
    """Save an existing article (full save with title, tags, content).

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
        return await save_article_service(
            access_token,
            slug,
            title,
            tags,
            content,
            message or f"update {slug}",
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


@mcp.tool()
async def delete_article(
    access_token: str = Field(description="GitHub access token"),
    slug: str = Field(description="Article slug (directory name)"),
) -> None:
    """Delete an article.

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).

    Returns:
        None

    Raises:
        ValueError: On invalid token, missing article, or GitHub API errors.
    """
    try:
        await delete_article_service(access_token, slug)
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
