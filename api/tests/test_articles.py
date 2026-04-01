import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.articles import _store


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


class TestListArticles:
    def test_returns_all_articles(self, client: TestClient):
        response = client.get("/articles")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == len(_store)
        slugs = {a["slug"] for a in data}
        assert "getting-started-with-typescript" in slugs


class TestGetArticle:
    def test_returns_article_by_slug(self, client: TestClient):
        response = client.get("/articles/getting-started-with-typescript")
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "getting-started-with-typescript"
        assert data["status"] == "published"
        assert "typescript" in data["tags"]

    def test_returns_404_for_unknown_slug(self, client: TestClient):
        response = client.get("/articles/does-not-exist")
        assert response.status_code == 404
        assert response.json()["detail"] == "Article not found"


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
