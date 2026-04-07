"""
Tests for app/mcp/tools.py

MCP tools wrap calls to github_articles functions and translate GitHub
HTTP errors into ValueError exceptions with human-readable messages.

Strategy: patch each github_articles function with an AsyncMock and test:
  1. Success paths (tool calls function, returns result)
  2. Error paths (tool catches HTTPStatusError, raises ValueError with message)
  3. Edge cases (empty lists, None values, etc.)
"""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.mcp import tools
from app.models.article import Article, ArticleMeta, ArticleVersion

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_article_meta() -> ArticleMeta:
    """Sample ArticleMeta for testing."""
    return ArticleMeta(
        slug="test-article",
        title="Test Article",
        status="draft",
        tags=["python", "testing"],
    )


@pytest.fixture
def sample_article_meta_no_tags() -> ArticleMeta:
    """ArticleMeta with empty tags list."""
    return ArticleMeta(
        slug="no-tags",
        title="Article Without Tags",
        status="published",
        tags=[],
    )


@pytest.fixture
def sample_article(sample_article_meta: ArticleMeta) -> Article:
    """Sample Article with content and versions."""
    return Article(
        slug="test-article",
        content="# Test Article\n\nThis is test content.",
        meta=sample_article_meta,
        versions=[
            ArticleVersion(
                sha="abc123def456",
                message="Initial commit",
                committed_at="2026-01-01T12:00:00Z",
            ),
            ArticleVersion(
                sha="def456ghi789",
                message="Update content",
                committed_at="2026-01-02T12:00:00Z",
            ),
        ],
    )


@pytest.fixture
def sample_article_no_versions(sample_article_meta: ArticleMeta) -> Article:
    """Article with empty versions list."""
    return Article(
        slug="test-article",
        content="# Test Article\n\nThis is test content.",
        meta=sample_article_meta,
        versions=[],
    )


def _make_github_error(status_code: int) -> httpx.HTTPStatusError:
    """Create an HTTPStatusError with the given status code."""
    response = httpx.Response(status_code, request=httpx.Request("GET", "https://api.github.com"))
    return httpx.HTTPStatusError(
        f"GitHub error {status_code}",
        request=response.request,
        response=response,
    )


# ---------------------------------------------------------------------------
# handle_list_articles
# ---------------------------------------------------------------------------


class TestListArticles:
    """Tests for list_articles tool."""

    @pytest.mark.asyncio
    async def test_success_returns_article_list(self, sample_article_meta):
        """Tool returns article list when GitHub call succeeds."""
        metas = [sample_article_meta]
        with patch(
            "app.mcp.tools.list_article_metas",
            new=AsyncMock(return_value=metas),
        ) as mock_list:
            result = await tools.list_articles("valid-token")

        assert len(result) == 1
        assert result[0].slug == "test-article"
        assert result[0].title == "Test Article"
        mock_list.assert_awaited_once_with("valid-token")

    @pytest.mark.asyncio
    async def test_success_with_empty_list(self):
        """Tool returns empty list when no articles exist."""
        with patch(
            "app.mcp.tools.list_article_metas",
            new=AsyncMock(return_value=[]),
        ) as mock_list:
            result = await tools.list_articles("valid-token")

        assert result == []
        mock_list.assert_awaited_once_with("valid-token")

    @pytest.mark.asyncio
    async def test_success_with_multiple_articles(
        self, sample_article_meta, sample_article_meta_no_tags
    ):
        """Tool returns multiple articles."""
        metas = [sample_article_meta, sample_article_meta_no_tags]
        with patch(
            "app.mcp.tools.list_article_metas",
            new=AsyncMock(return_value=metas),
        ):
            result = await tools.list_articles("valid-token")

        assert len(result) == 2
        slugs = {m.slug for m in result}
        assert "test-article" in slugs
        assert "no-tags" in slugs

    @pytest.mark.asyncio
    async def test_error_401_invalid_token(self):
        """Tool raises ValueError with 'Invalid GitHub token' on 401."""
        error = _make_github_error(401)
        with patch(
            "app.mcp.tools.list_article_metas",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Invalid GitHub token"):
                await tools.list_articles("bad-token")

    @pytest.mark.asyncio
    async def test_error_502_github_api_down(self):
        """Tool raises ValueError with 'GitHub API error: 502' on 502."""
        error = _make_github_error(502)
        with patch(
            "app.mcp.tools.list_article_metas",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 502"):
                await tools.list_articles("valid-token")

    @pytest.mark.asyncio
    async def test_error_503_generic_http_error(self):
        """Tool translates non-401/502 HTTP errors to generic message."""
        error = _make_github_error(503)
        with patch(
            "app.mcp.tools.list_article_metas",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 503"):
                await tools.list_articles("valid-token")

    @pytest.mark.asyncio
    async def test_error_unexpected_exception(self):
        """Tool catches unexpected exceptions and wraps in ValueError."""
        with patch(
            "app.mcp.tools.list_article_metas",
            new=AsyncMock(side_effect=RuntimeError("Network timeout")),
        ):
            with pytest.raises(ValueError, match="Failed to fetch articles"):
                await tools.list_articles("valid-token")


# ---------------------------------------------------------------------------
# get_article
# ---------------------------------------------------------------------------


class TestGetArticle:
    """Tests for get_article tool."""

    @pytest.mark.asyncio
    async def test_success_returns_article(self, sample_article):
        """Tool returns full article when GitHub call succeeds."""
        with patch(
            "app.mcp.tools.get_article_service",
            new=AsyncMock(return_value=sample_article),
        ) as mock_get:
            result = await tools.get_article("valid-token", "test-article")

        assert result.slug == "test-article"
        assert result.meta.title == "Test Article"
        assert result.content == "# Test Article\n\nThis is test content."
        assert len(result.versions) == 2
        mock_get.assert_awaited_once_with("valid-token", "test-article")

    @pytest.mark.asyncio
    async def test_success_with_no_versions(self, sample_article_no_versions):
        """Tool returns article with empty versions list."""
        with patch(
            "app.mcp.tools.get_article_service",
            new=AsyncMock(return_value=sample_article_no_versions),
        ):
            result = await tools.get_article("valid-token", "test-article")

        assert result.versions == []

    @pytest.mark.asyncio
    async def test_error_401_invalid_token(self):
        """Tool raises ValueError with 'Invalid GitHub token' on 401."""
        error = _make_github_error(401)
        with patch(
            "app.mcp.tools.get_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Invalid GitHub token"):
                await tools.get_article("bad-token", "test-article")

    @pytest.mark.asyncio
    async def test_error_404_article_not_found(self):
        """Tool raises ValueError with 'Article not found' on 404."""
        error = _make_github_error(404)
        with patch(
            "app.mcp.tools.get_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Article not found"):
                await tools.get_article("valid-token", "missing-slug")

    @pytest.mark.asyncio
    async def test_error_502_github_api_down(self):
        """Tool raises ValueError with 'GitHub API error: 502' on 502."""
        error = _make_github_error(502)
        with patch(
            "app.mcp.tools.get_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 502"):
                await tools.get_article("valid-token", "test-article")

    @pytest.mark.asyncio
    async def test_error_500_generic_http_error(self):
        """Tool translates non-401/404/502 HTTP errors to generic message."""
        error = _make_github_error(500)
        with patch(
            "app.mcp.tools.get_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 500"):
                await tools.get_article("valid-token", "test-article")

    @pytest.mark.asyncio
    async def test_error_unexpected_exception(self):
        """Tool catches unexpected exceptions and wraps in ValueError."""
        with patch(
            "app.mcp.tools.get_article_service",
            new=AsyncMock(side_effect=RuntimeError("Malformed meta.json")),
        ):
            with pytest.raises(ValueError, match="Failed to fetch article"):
                await tools.get_article("valid-token", "test-article")


# ---------------------------------------------------------------------------
# create_article
# ---------------------------------------------------------------------------


class TestCreateArticle:
    """Tests for create_article tool."""

    @pytest.mark.asyncio
    async def test_success_creates_article(self, sample_article):
        """Tool returns created article when GitHub call succeeds."""
        with patch(
            "app.mcp.tools.create_article",
            new=AsyncMock(return_value=sample_article),
        ) as mock_create:
            result = await tools.create_article(
                "valid-token",
                "Test Article",
                "test-article",
                ["python", "testing"],
                "# Test Article\n\nThis is test content.",
            )

        assert result.slug == "test-article"
        assert result.meta.title == "Test Article"
        assert "python" in result.meta.tags
        mock_create.assert_awaited_once_with(
            "valid-token",
            "Test Article",
            "test-article",
            ["python", "testing"],
            "# Test Article\n\nThis is test content.",
        )

    @pytest.mark.asyncio
    async def test_success_with_empty_tags(self, sample_article_meta_no_tags):
        """Tool creates article with empty tags list."""
        article = Article(
            slug="no-tags",
            content="# Article\n\nContent.",
            meta=sample_article_meta_no_tags,
            versions=[],
        )
        with patch(
            "app.mcp.tools.create_article",
            new=AsyncMock(return_value=article),
        ):
            result = await tools.create_article(
                "valid-token",
                "Article Without Tags",
                "no-tags",
                [],
                "# Article\n\nContent.",
            )

        assert result.meta.tags == []

    @pytest.mark.asyncio
    async def test_success_with_empty_content(self, sample_article_meta):
        """Tool creates article with empty initial content."""
        article = Article(
            slug="empty-content",
            content="",
            meta=sample_article_meta,
            versions=[],
        )
        with patch(
            "app.mcp.tools.create_article",
            new=AsyncMock(return_value=article),
        ):
            result = await tools.create_article(
                "valid-token",
                "Test Article",
                "test-article",
                ["python"],
                "",
            )

        assert result.content == ""

    @pytest.mark.asyncio
    async def test_error_401_invalid_token(self):
        """Tool raises ValueError with 'Invalid GitHub token' on 401."""
        error = _make_github_error(401)
        with patch(
            "app.mcp.tools.create_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Invalid GitHub token"):
                await tools.create_article("bad-token", "Title", "slug", [], "content")

    @pytest.mark.asyncio
    async def test_error_409_slug_conflict(self):
        """Tool raises ValueError with slug conflict message on 409."""
        error = _make_github_error(409)
        with patch(
            "app.mcp.tools.create_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Article with slug 'existing' already exists"):
                await tools.create_article("valid-token", "Title", "existing", [], "content")

    @pytest.mark.asyncio
    async def test_error_502_github_api_down(self):
        """Tool raises ValueError with 'GitHub API error: 502' on 502."""
        error = _make_github_error(502)
        with patch(
            "app.mcp.tools.create_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 502"):
                await tools.create_article("valid-token", "Title", "slug", [], "content")

    @pytest.mark.asyncio
    async def test_error_500_generic_http_error(self):
        """Tool translates non-401/409/502 HTTP errors to generic message."""
        error = _make_github_error(500)
        with patch(
            "app.mcp.tools.create_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 500"):
                await tools.create_article("valid-token", "Title", "slug", [], "content")

    @pytest.mark.asyncio
    async def test_error_unexpected_exception(self):
        """Tool catches unexpected exceptions and wraps in ValueError."""
        with patch(
            "app.mcp.tools.create_article_service",
            new=AsyncMock(side_effect=RuntimeError("Invalid JSON")),
        ):
            with pytest.raises(ValueError, match="Failed to create article"):
                await tools.create_article("valid-token", "Title", "slug", [], "content")


# ---------------------------------------------------------------------------
# save_article
# ---------------------------------------------------------------------------


class TestSaveArticle:
    """Tests for save_article tool."""

    @pytest.mark.asyncio
    async def test_success_saves_article(self, sample_article):
        """Tool returns saved article when GitHub call succeeds."""
        with patch(
            "app.mcp.tools.save_article",
            new=AsyncMock(return_value=sample_article),
        ) as mock_save:
            result = await tools.save_article(
                "valid-token",
                "test-article",
                "Updated Title",
                ["python"],
                "# Updated\n\nContent.",
                "Fix typo",
            )

        assert result.slug == "test-article"
        assert result.meta.title == "Test Article"  # from sample fixture
        mock_save.assert_awaited_once_with(
            "valid-token",
            "test-article",
            "Updated Title",
            ["python"],
            "# Updated\n\nContent.",
            "Fix typo",
        )

    @pytest.mark.asyncio
    async def test_success_with_none_message_generates_default(self, sample_article):
        """Tool generates default message when message is None."""
        with patch(
            "app.mcp.tools.save_article_service",
            new=AsyncMock(return_value=sample_article),
        ) as mock_save:
            result = await tools.save_article(
                "valid-token",
                "test-article",
                "Updated Title",
                ["python"],
                "# Updated\n\nContent.",
                None,
            )

        assert result.slug == "test-article"
        # Verify default message was passed
        mock_save.assert_awaited_once_with(
            "valid-token",
            "test-article",
            "Updated Title",
            ["python"],
            "# Updated\n\nContent.",
            "update test-article",
        )

    @pytest.mark.asyncio
    async def test_success_with_empty_tags(self, sample_article_meta_no_tags):
        """Tool saves article with empty tags list."""
        article = Article(
            slug="test-article",
            content="# Content",
            meta=sample_article_meta_no_tags,
            versions=[],
        )
        with patch(
            "app.mcp.tools.save_article",
            new=AsyncMock(return_value=article),
        ):
            result = await tools.save_article(
                "valid-token",
                "test-article",
                "Title",
                [],
                "# Content",
                "Save",
            )

        assert result.meta.tags == []

    @pytest.mark.asyncio
    async def test_error_401_invalid_token(self):
        """Tool raises ValueError with 'Invalid GitHub token' on 401."""
        error = _make_github_error(401)
        with patch(
            "app.mcp.tools.save_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Invalid GitHub token"):
                await tools.save_article("bad-token", "slug", "Title", [], "content", "msg")

    @pytest.mark.asyncio
    async def test_error_404_article_not_found(self):
        """Tool raises ValueError with 'Article not found' on 404."""
        error = _make_github_error(404)
        with patch(
            "app.mcp.tools.save_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Article not found"):
                await tools.save_article(
                    "valid-token", "missing-slug", "Title", [], "content", "msg"
                )

    @pytest.mark.asyncio
    async def test_error_502_github_api_down(self):
        """Tool raises ValueError with 'GitHub API error: 502' on 502."""
        error = _make_github_error(502)
        with patch(
            "app.mcp.tools.save_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 502"):
                await tools.save_article("valid-token", "slug", "Title", [], "content", "msg")

    @pytest.mark.asyncio
    async def test_error_500_generic_http_error(self):
        """Tool translates non-401/404/502 HTTP errors to generic message."""
        error = _make_github_error(500)
        with patch(
            "app.mcp.tools.save_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 500"):
                await tools.save_article("valid-token", "slug", "Title", [], "content", "msg")

    @pytest.mark.asyncio
    async def test_error_unexpected_exception(self):
        """Tool catches unexpected exceptions and wraps in ValueError."""
        with patch(
            "app.mcp.tools.save_article_service",
            new=AsyncMock(side_effect=RuntimeError("Malformed data")),
        ):
            with pytest.raises(ValueError, match="Failed to save article"):
                await tools.save_article("valid-token", "slug", "Title", [], "content", "msg")


# ---------------------------------------------------------------------------
# delete_article
# ---------------------------------------------------------------------------


class TestDeleteArticle:
    """Tests for delete_article tool."""

    @pytest.mark.asyncio
    async def test_success_deletes_article(self):
        """Tool returns None when GitHub call succeeds."""
        with patch(
            "app.mcp.tools.delete_article_service",
            new=AsyncMock(return_value=None),
        ) as mock_delete:
            result = await tools.delete_article("valid-token", "test-article")

        assert result is None
        mock_delete.assert_awaited_once_with("valid-token", "test-article")

    @pytest.mark.asyncio
    async def test_error_401_invalid_token(self):
        """Tool raises ValueError with 'Invalid GitHub token' on 401."""
        error = _make_github_error(401)
        with patch(
            "app.mcp.tools.delete_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Invalid GitHub token"):
                await tools.delete_article("bad-token", "test-article")

    @pytest.mark.asyncio
    async def test_error_404_article_not_found(self):
        """Tool raises ValueError with 'Article not found' on 404."""
        error = _make_github_error(404)
        with patch(
            "app.mcp.tools.delete_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="Article not found"):
                await tools.delete_article("valid-token", "missing-slug")

    @pytest.mark.asyncio
    async def test_error_502_github_api_down(self):
        """Tool raises ValueError with 'GitHub API error: 502' on 502."""
        error = _make_github_error(502)
        with patch(
            "app.mcp.tools.delete_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 502"):
                await tools.delete_article("valid-token", "test-article")

    @pytest.mark.asyncio
    async def test_error_500_generic_http_error(self):
        """Tool translates non-401/404/502 HTTP errors to generic message."""
        error = _make_github_error(500)
        with patch(
            "app.mcp.tools.delete_article_service",
            new=AsyncMock(side_effect=error),
        ):
            with pytest.raises(ValueError, match="GitHub API error: 500"):
                await tools.delete_article("valid-token", "test-article")

    @pytest.mark.asyncio
    async def test_error_unexpected_exception(self):
        """Tool catches unexpected exceptions and wraps in ValueError."""
        with patch(
            "app.mcp.tools.delete_article_service",
            new=AsyncMock(side_effect=RuntimeError("Network error")),
        ):
            with pytest.raises(ValueError, match="Failed to delete article"):
                await tools.delete_article("valid-token", "test-article")
