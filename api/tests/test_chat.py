"""Tests for chat endpoints."""

# ruff: noqa: ANN001, ANN201
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main_rest import app
from app.routers.chat import _threads

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_chat_state() -> None:
    """Reset in-memory thread store before each test."""
    _threads.clear()
    yield


@pytest.fixture
def mock_github_user():  # type: ignore[no-untyped-def]
    """Mock GitHub user API response."""
    with patch("app.routers.chat.httpx.AsyncClient") as mock_client_class:
        mock_response = AsyncMock()
        mock_response.json = lambda: {"login": "testuser"}
        mock_response.raise_for_status = AsyncMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        mock_client_class.return_value = mock_client
        yield mock_client_class


class TestListThreads:
    """Test GET /chat/threads."""

    def test_requires_authentication(self):
        """Unauthenticated requests return 401."""
        response = client.get("/chat/threads?article_slug=test-article")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_threads_empty(self, mock_github_user):
        """Returns empty list when no threads exist."""
        response = client.get(
            "/chat/threads?article_slug=test-article",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_threads_with_data(self, mock_github_user):
        """Returns threads for the user+article."""
        # Create a thread first
        _threads[("testuser", "test-article")] = [
            {
                "thread_id": "thread-1",
                "article_slug": "test-article",
                "title": "First question",
                "created_at": "2026-04-20T12:00:00Z",
            }
        ]

        response = client.get(
            "/chat/threads?article_slug=test-article",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["thread_id"] == "thread-1"
        assert data[0]["title"] == "First question"

    @pytest.mark.asyncio
    async def test_list_threads_scoped_by_article(self, mock_github_user):
        """Only returns threads for the specified article."""
        _threads[("testuser", "article-1")] = [
            {
                "thread_id": "thread-1",
                "article_slug": "article-1",
                "title": "Q1",
                "created_at": "2026-04-20T12:00:00Z",
            }
        ]
        _threads[("testuser", "article-2")] = [
            {
                "thread_id": "thread-2",
                "article_slug": "article-2",
                "title": "Q2",
                "created_at": "2026-04-20T12:00:00Z",
            }
        ]

        response = client.get(
            "/chat/threads?article_slug=article-1",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["thread_id"] == "thread-1"


class TestCreateThread:
    """Test POST /chat/threads."""

    def test_requires_authentication(self):
        """Unauthenticated requests return 401."""
        response = client.post("/chat/threads", json={"article_slug": "test-article"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_thread(self, mock_github_user):
        """Creates a new thread and returns it."""
        response = client.post(
            "/chat/threads",
            json={"article_slug": "test-article"},
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["article_slug"] == "test-article"
        assert data["thread_id"]
        assert data["created_at"]
        assert data["title"] == ""  # Empty until first message

    @pytest.mark.asyncio
    async def test_create_multiple_threads(self, mock_github_user):
        """Can create multiple threads for the same article."""
        response1 = client.post(
            "/chat/threads",
            json={"article_slug": "test-article"},
            cookies={"gh_access_token": "test_token"},
        )
        response2 = client.post(
            "/chat/threads",
            json={"article_slug": "test-article"},
            cookies={"gh_access_token": "test_token"},
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        data1 = response1.json()
        data2 = response2.json()
        assert data1["thread_id"] != data2["thread_id"]

        # Both should be stored
        response_list = client.get(
            "/chat/threads?article_slug=test-article",
            cookies={"gh_access_token": "test_token"},
        )
        assert len(response_list.json()) == 2


class TestSendMessage:
    """Test POST /chat/threads/{thread_id}/messages."""

    def test_requires_authentication(self):
        """Unauthenticated requests return 401."""
        response = client.post(
            "/chat/threads/thread-1/messages",
            json={"content": "Hello", "article_content": "Test"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_thread_not_found(self, mock_github_user):
        """Returns 404 when thread does not exist."""
        response = client.post(
            "/chat/threads/nonexistent/messages",
            json={"content": "Hello", "article_content": "Test"},
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_thread_not_owned_by_user(self, mock_github_user):
        """Returns 404 when thread belongs to a different user."""
        _threads[("otheruser", "test-article")] = [
            {
                "thread_id": "thread-1",
                "article_slug": "test-article",
                "title": "",
                "created_at": "2026-04-20T12:00:00Z",
            }
        ]

        response = client.post(
            "/chat/threads/thread-1/messages",
            json={"content": "Hello", "article_content": "Test"},
            cookies={"gh_access_token": "test_token"},
        )
        # testuser calling, but thread belongs to otheruser
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_send_message_success(self, mock_github_user):
        """Sends a message and receives a response."""
        # Create a thread first
        create_response = client.post(
            "/chat/threads",
            json={"article_slug": "test-article"},
            cookies={"gh_access_token": "test_token"},
        )
        thread_id = create_response.json()["thread_id"]

        # Mock the graph invoke to return a simple response
        with patch("app.routers.chat.graph") as mock_graph:
            from langchain_core.messages import AIMessage

            mock_graph.invoke.return_value = {
                "messages": [
                    None,  # System message
                    None,  # Human message
                    AIMessage(content="This is a helpful response about your article."),
                ]
            }

            response = client.post(
                f"/chat/threads/{thread_id}/messages",
                json={
                    "content": "How can I improve this article?",
                    "article_content": "The article content goes here.",
                },
                cookies={"gh_access_token": "test_token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["thread_id"] == thread_id
        assert data["reply"] == "This is a helpful response about your article."
        assert len(data["history"]) == 2
        assert data["history"][0]["role"] == "human"
        assert data["history"][0]["content"] == "How can I improve this article?"
        assert data["history"][1]["role"] == "ai"

    @pytest.mark.asyncio
    async def test_message_sets_thread_title(self, mock_github_user):
        """First message sets the thread title."""
        create_response = client.post(
            "/chat/threads",
            json={"article_slug": "test-article"},
            cookies={"gh_access_token": "test_token"},
        )
        thread_id = create_response.json()["thread_id"]

        with patch("app.routers.chat.graph") as mock_graph:
            from langchain_core.messages import AIMessage

            mock_graph.invoke.return_value = {
                "messages": [
                    None,
                    None,
                    AIMessage(content="Response"),
                ]
            }

            client.post(
                f"/chat/threads/{thread_id}/messages",
                json={
                    "content": "This is my question about the article",
                    "article_content": "Article content",
                },
                cookies={"gh_access_token": "test_token"},
            )

        # Check that the thread title was updated
        response = client.get(
            "/chat/threads?article_slug=test-article",
            cookies={"gh_access_token": "test_token"},
        )
        threads = response.json()
        assert len(threads) == 1
        assert threads[0]["title"] == "This is my question about the article"

    @pytest.mark.asyncio
    async def test_message_title_truncated_at_60_chars(self, mock_github_user):
        """Thread title is truncated if message is longer than 60 chars."""
        create_response = client.post(
            "/chat/threads",
            json={"article_slug": "test-article"},
            cookies={"gh_access_token": "test_token"},
        )
        thread_id = create_response.json()["thread_id"]

        long_message = "This is a very long question " * 5

        with patch("app.routers.chat.graph") as mock_graph:
            from langchain_core.messages import AIMessage

            mock_graph.invoke.return_value = {
                "messages": [None, None, AIMessage(content="Response")]
            }

            client.post(
                f"/chat/threads/{thread_id}/messages",
                json={
                    "content": long_message,
                    "article_content": "Article content",
                },
                cookies={"gh_access_token": "test_token"},
            )

        response = client.get(
            "/chat/threads?article_slug=test-article",
            cookies={"gh_access_token": "test_token"},
        )
        threads = response.json()
        assert len(threads[0]["title"]) <= 63  # 60 + "..."
