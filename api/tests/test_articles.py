from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.article import Article, ArticleMeta


@pytest.fixture
def client():
    return TestClient(app)


TOKEN = "test-token"
COOKIE_HEADER = {"Cookie": f"gh_access_token={TOKEN}"}


# ---------------------------------------------------------------------------
# GET /articles — GitHub-backed
# ---------------------------------------------------------------------------


class TestListArticles:
    def test_returns_metas_for_authenticated_user(self, client: TestClient):
        metas = [
            ArticleMeta(
                slug="hello-world",
                title="Hello World",
                status="published",
                tags=["intro"],
            ),
            ArticleMeta(
                slug="second-post",
                title="Second Post",
                status="draft",
                tags=[],
            ),
        ]
        with patch(
            "app.routers.articles.list_article_metas",
            new=AsyncMock(return_value=metas),
        ) as mock_list:
            response = client.get("/articles", headers=COOKIE_HEADER)

        assert response.status_code == 200
        mock_list.assert_awaited_once_with(TOKEN)
        data = response.json()
        assert len(data) == 2
        slugs = {a["slug"] for a in data}
        assert "hello-world" in slugs
        assert "second-post" in slugs
        # Metas must NOT contain 'content'
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
            "app.routers.articles.list_article_metas",
            new=AsyncMock(side_effect=error),
        ):
            response = client.get("/articles", headers=COOKIE_HEADER)
        assert response.status_code == 502
        assert "503" in response.json()["detail"]

    def test_returns_502_on_unexpected_exception(self, client: TestClient):
        with patch(
            "app.routers.articles.list_article_metas",
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
            content="# Hello\n\nContent.",
            meta=ArticleMeta(
                slug="hello-world",
                title="Hello World",
                status="published",
                tags=["intro"],
            ),
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
        assert data["meta"]["status"] == "published"
        assert data["content"] == "# Hello\n\nContent."
        assert "intro" in data["meta"]["tags"]

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
