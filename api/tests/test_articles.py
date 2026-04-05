from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.article import Article, ArticleSummary


@pytest.fixture(autouse=True)
def reset_store():
    """Reset the in-memory store to a known state before each test."""
    from app.routers import articles as articles_module

    original = dict(articles_module._store)
    yield
    articles_module._store.clear()
    articles_module._store.update(original)


@pytest.fixture
def client():
    return TestClient(app)


TOKEN = "test-token"
COOKIE_HEADER = {"Cookie": f"gh_access_token={TOKEN}"}


# ---------------------------------------------------------------------------
# GET /articles — GitHub-backed
# ---------------------------------------------------------------------------


class TestListArticles:
    def test_returns_summaries_for_authenticated_user(self, client: TestClient):
        summaries = [
            ArticleSummary(
                slug="hello-world",
                title="Hello World",
                status="published",
                tags=["intro"],
            ),
            ArticleSummary(
                slug="second-post",
                title="Second Post",
                status="draft",
                tags=[],
            ),
        ]
        with patch(
            "app.routers.articles.list_article_summaries",
            new=AsyncMock(return_value=summaries),
        ) as mock_list:
            response = client.get("/articles", headers=COOKIE_HEADER)

        assert response.status_code == 200
        mock_list.assert_awaited_once_with(TOKEN)
        data = response.json()
        assert len(data) == 2
        slugs = {a["slug"] for a in data}
        assert "hello-world" in slugs
        assert "second-post" in slugs
        # Summaries must NOT contain 'content'
        assert "content" not in data[0]

    def test_returns_401_when_no_cookie(self, client: TestClient):
        response = client.get("/articles")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_returns_502_on_github_http_error(self, client: TestClient):
        github_response = httpx.Response(
            503, request=httpx.Request("GET", "https://api.github.com")
        )
        error = httpx.HTTPStatusError(
            "server error", request=github_response.request, response=github_response
        )
        with patch(
            "app.routers.articles.list_article_summaries",
            new=AsyncMock(side_effect=error),
        ):
            response = client.get("/articles", headers=COOKIE_HEADER)
        assert response.status_code == 502
        assert "503" in response.json()["detail"]

    def test_returns_502_on_unexpected_exception(self, client: TestClient):
        with patch(
            "app.routers.articles.list_article_summaries",
            new=AsyncMock(side_effect=RuntimeError("unexpected")),
        ):
            response = client.get("/articles", headers=COOKIE_HEADER)
        assert response.status_code == 502
        assert response.json()["detail"] == "Failed to fetch articles from GitHub"


# ---------------------------------------------------------------------------
# GET /articles/{slug} — GitHub-backed
# ---------------------------------------------------------------------------


class TestGetArticle:
    def test_returns_article_for_authenticated_user(self, client: TestClient):
        article = Article(
            slug="hello-world",
            title="Hello World",
            status="published",
            tags=["intro"],
            content="# Hello\n\nContent.",
        )
        with patch(
            "app.routers.articles.gh_get_article",
            new=AsyncMock(return_value=article),
        ) as mock_get:
            response = client.get("/articles/hello-world", headers=COOKIE_HEADER)

        assert response.status_code == 200
        mock_get.assert_awaited_once_with(TOKEN, "hello-world")
        data = response.json()
        assert data["slug"] == "hello-world"
        assert data["status"] == "published"
        assert data["content"] == "# Hello\n\nContent."
        assert "intro" in data["tags"]

    def test_returns_401_when_no_cookie(self, client: TestClient):
        response = client.get("/articles/hello-world")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_returns_404_when_github_returns_404(self, client: TestClient):
        github_response = httpx.Response(
            404, request=httpx.Request("GET", "https://api.github.com")
        )
        error = httpx.HTTPStatusError(
            "not found", request=github_response.request, response=github_response
        )
        with patch(
            "app.routers.articles.gh_get_article",
            new=AsyncMock(side_effect=error),
        ):
            response = client.get("/articles/missing-slug", headers=COOKIE_HEADER)
        assert response.status_code == 404
        assert response.json()["detail"] == "Article not found"

    def test_returns_502_on_github_http_error(self, client: TestClient):
        github_response = httpx.Response(
            500, request=httpx.Request("GET", "https://api.github.com")
        )
        error = httpx.HTTPStatusError(
            "server error", request=github_response.request, response=github_response
        )
        with patch(
            "app.routers.articles.gh_get_article",
            new=AsyncMock(side_effect=error),
        ):
            response = client.get("/articles/some-slug", headers=COOKIE_HEADER)
        assert response.status_code == 502
        assert "500" in response.json()["detail"]

    def test_returns_502_on_malformed_meta(self, client: TestClient):
        with patch(
            "app.routers.articles.gh_get_article",
            new=AsyncMock(side_effect=ValueError("Invalid meta.json")),
        ):
            response = client.get("/articles/bad-article", headers=COOKIE_HEADER)
        assert response.status_code == 502
        assert response.json()["detail"] == "Malformed article data"


# ---------------------------------------------------------------------------
# POST /articles — in-memory (unchanged)
# ---------------------------------------------------------------------------


class TestCreateArticle:
    def test_creates_new_article(self, client: TestClient):
        new_article = {
            "slug": "test-article",
            "title": "Test Article",
            "status": "draft",
            "content": "# Test\n\nContent here.",
            "tags": ["test"],
        }
        response = client.post("/articles", json=new_article)
        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "test-article"
        assert data["title"] == "Test Article"

    def test_returns_409_on_slug_conflict(self, client: TestClient):
        article = {
            "slug": "getting-started-with-typescript",
            "title": "Duplicate",
            "status": "draft",
            "content": "",
            "tags": [],
        }
        response = client.post("/articles", json=article)
        assert response.status_code == 409
        assert response.json()["detail"] == "Article slug already exists"


# ---------------------------------------------------------------------------
# PATCH /articles/{slug} — in-memory (unchanged)
# ---------------------------------------------------------------------------


class TestPatchArticle:
    def test_updates_article_status(self, client: TestClient):
        response = client.patch(
            "/articles/git-workflow-for-writers",
            json={"status": "published"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "published"
        assert data["slug"] == "git-workflow-for-writers"
        assert data["title"] == "Git Workflow for Writers"

    def test_updates_partial_fields(self, client: TestClient):
        response = client.patch(
            "/articles/git-workflow-for-writers",
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "draft"

    def test_returns_404_for_unknown_slug(self, client: TestClient):
        response = client.patch("/articles/nonexistent", json={"status": "published"})
        assert response.status_code == 404
        assert response.json()["detail"] == "Article not found"
