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


def test_list_articles_returns_all(client: TestClient):
    response = client.get("/articles")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(_store)
    slugs = {a["slug"] for a in data}
    assert "getting-started-with-typescript" in slugs


def test_get_article_found(client: TestClient):
    response = client.get("/articles/getting-started-with-typescript")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "getting-started-with-typescript"
    assert data["status"] == "published"
    assert "typescript" in data["tags"]


def test_get_article_not_found(client: TestClient):
    response = client.get("/articles/does-not-exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Article not found"


def test_create_article(client: TestClient):
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


def test_create_article_slug_conflict(client: TestClient):
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


def test_patch_article_status(client: TestClient):
    response = client.patch(
        "/articles/git-workflow-for-writers",
        json={"status": "published"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "published"
    assert data["slug"] == "git-workflow-for-writers"
    assert data["title"] == "Git Workflow for Writers"


def test_patch_article_partial_update(client: TestClient):
    response = client.patch(
        "/articles/git-workflow-for-writers",
        json={"title": "Updated Title"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["status"] == "draft"


def test_patch_article_not_found(client: TestClient):
    response = client.patch("/articles/nonexistent", json={"status": "published"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Article not found"
