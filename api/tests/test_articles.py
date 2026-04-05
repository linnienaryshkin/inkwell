from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.article import Article, ArticleMeta, ArticleVersion


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


# ---------------------------------------------------------------------------
# POST /articles — create article endpoint
# ---------------------------------------------------------------------------


def _make_article(slug: str, title: str = "Test Article", tags: list | None = None) -> Article:
    return Article(
        slug=slug,
        content="# Test\n\nContent.",
        meta=ArticleMeta(
            slug=slug,
            title=title,
            status="draft",
            tags=tags or [],
        ),
        versions=[
            ArticleVersion(
                sha="abc123", message="create article", committed_at="2026-01-01T00:00:00Z"
            )
        ],
    )


def _github_502_error() -> httpx.HTTPStatusError:
    github_response = httpx.Response(503, request=httpx.Request("PUT", "https://api.github.com"))
    return httpx.HTTPStatusError(
        "server error", request=github_response.request, response=github_response
    )


class TestCreateArticleEndpoint:
    def test_creates_article_returns_201(self, client: TestClient):
        """
        POST /articles with valid body returns 201 and the full Article shape.
        """
        article = _make_article("my-new-post", "My New Post", ["python"])
        with patch(
            "app.routers.articles.gh_create_article",
            new=AsyncMock(return_value=article),
        ) as mock_create:
            response = client.post(
                "/articles",
                json={
                    "title": "My New Post",
                    "slug": "my-new-post",
                    "tags": ["python"],
                    "content": "# Hello",
                },
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 201
        mock_create.assert_awaited_once()
        data = response.json()
        assert data["slug"] == "my-new-post"
        assert data["meta"]["title"] == "My New Post"
        assert data["meta"]["status"] == "draft"
        assert "content" in data
        assert "versions" in data

    def test_returns_401_when_no_cookie(self, client: TestClient):
        """
        POST /articles without auth cookie returns 401.
        """
        response = client.post(
            "/articles",
            json={"title": "Test", "slug": "test", "tags": [], "content": ""},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_returns_409_on_duplicate_slug(self, client: TestClient):
        """
        When GitHub returns 422 (file exists), the endpoint maps it to 409 with slug in detail.
        """
        slug = "existing-slug"
        github_response = httpx.Response(
            422, request=httpx.Request("PUT", "https://api.github.com")
        )
        error = httpx.HTTPStatusError(
            "unprocessable", request=github_response.request, response=github_response
        )
        with patch(
            "app.routers.articles.gh_create_article",
            new=AsyncMock(side_effect=error),
        ):
            response = client.post(
                "/articles",
                json={"title": "Existing Slug", "slug": slug, "tags": [], "content": ""},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 409
        assert slug in response.json()["detail"]

    def test_returns_422_on_invalid_slug(self, client: TestClient):
        """
        Slug with uppercase letters is rejected with 422.
        """
        response = client.post(
            "/articles",
            json={"title": "Bad Slug", "slug": "BadSlug", "tags": [], "content": ""},
            headers=COOKIE_HEADER,
        )
        assert response.status_code == 422
        assert "Slug must be lowercase" in response.json()["detail"]

    def test_returns_422_on_empty_title(self, client: TestClient):
        """
        Empty title string is rejected with 422.
        """
        response = client.post(
            "/articles",
            json={"title": "", "slug": "valid-slug", "tags": [], "content": ""},
            headers=COOKIE_HEADER,
        )
        assert response.status_code == 422
        assert "Title must not be empty" in response.json()["detail"]

    def test_returns_422_on_whitespace_title(self, client: TestClient):
        """
        Whitespace-only title is rejected with 422.
        """
        response = client.post(
            "/articles",
            json={"title": "   ", "slug": "valid-slug", "tags": [], "content": ""},
            headers=COOKIE_HEADER,
        )
        assert response.status_code == 422
        assert "Title must not be empty" in response.json()["detail"]

    def test_returns_502_on_github_error(self, client: TestClient):
        """
        Non-422 GitHub error propagates as 502 from the endpoint.
        """
        with patch(
            "app.routers.articles.gh_create_article",
            new=AsyncMock(side_effect=_github_502_error()),
        ):
            response = client.post(
                "/articles",
                json={"title": "OK Title", "slug": "ok-slug", "tags": [], "content": ""},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 502
        assert "503" in response.json()["detail"]


# ---------------------------------------------------------------------------
# PATCH /articles/{slug} — save article endpoint
# ---------------------------------------------------------------------------


class TestSaveArticleEndpoint:
    def test_saves_article_returns_200(self, client: TestClient):
        """
        PATCH /articles/{slug} with valid body returns 200 and the full Article shape.
        """
        slug = "existing-post"
        article = _make_article(slug, "Updated Title", ["updated"])
        with patch(
            "app.routers.articles.gh_save_article",
            new=AsyncMock(return_value=article),
        ) as mock_save:
            response = client.patch(
                f"/articles/{slug}",
                json={
                    "title": "Updated Title",
                    "tags": ["updated"],
                    "content": "# Updated",
                    "message": "fix typo",
                },
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 200
        mock_save.assert_awaited_once()
        data = response.json()
        assert data["slug"] == slug
        assert data["meta"]["title"] == "Updated Title"
        assert "content" in data
        assert "versions" in data

    def test_returns_401_when_no_cookie(self, client: TestClient):
        """
        PATCH /articles/{slug} without auth cookie returns 401.
        """
        response = client.patch(
            "/articles/some-slug",
            json={"title": "Title", "tags": [], "content": "content"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_returns_404_when_article_not_found(self, client: TestClient):
        """
        When GitHub returns 404 (file does not exist), the endpoint maps it to 404.
        """
        github_response = httpx.Response(
            404, request=httpx.Request("GET", "https://api.github.com")
        )
        error = httpx.HTTPStatusError(
            "not found", request=github_response.request, response=github_response
        )
        with patch(
            "app.routers.articles.gh_save_article",
            new=AsyncMock(side_effect=error),
        ):
            response = client.patch(
                "/articles/missing-slug",
                json={"title": "T", "tags": [], "content": "c"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 404
        assert response.json()["detail"] == "Article not found"

    def test_returns_502_on_github_error(self, client: TestClient):
        """
        Non-404 GitHub error propagates as 502 from the endpoint.
        """
        github_response = httpx.Response(
            500, request=httpx.Request("GET", "https://api.github.com")
        )
        error = httpx.HTTPStatusError(
            "server error", request=github_response.request, response=github_response
        )
        with patch(
            "app.routers.articles.gh_save_article",
            new=AsyncMock(side_effect=error),
        ):
            response = client.patch(
                "/articles/some-slug",
                json={"title": "T", "tags": [], "content": "c"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 502
        assert "500" in response.json()["detail"]

    def test_default_message_when_omitted(self, client: TestClient):
        """
        When 'message' is omitted from the body, the router passes 'update <slug>'
        to gh_save_article.
        """
        slug = "my-article"
        article = _make_article(slug)
        with patch(
            "app.routers.articles.gh_save_article",
            new=AsyncMock(return_value=article),
        ) as mock_save:
            response = client.patch(
                f"/articles/{slug}",
                json={"title": "T", "tags": [], "content": "c"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 200
        mock_save.assert_awaited_once_with(TOKEN, slug, "T", [], "c", f"update {slug}")

    def test_returns_422_on_invalid_slug(self, client: TestClient):
        """
        Slug with uppercase letters or invalid characters is rejected with 422 before
        the GitHub API is called.
        """
        for bad_slug in ["BadSlug", "has.dots", "UPPER"]:
            response = client.patch(
                f"/articles/{bad_slug}",
                json={"title": "T", "tags": [], "content": "c"},
                headers=COOKIE_HEADER,
            )
            assert response.status_code == 422, f"expected 422 for slug {bad_slug!r}"
            assert "Slug must be lowercase" in response.json()["detail"]
