"""Tests for chat endpoints."""

# ruff: noqa: ANN001, ANN201
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main_rest import app
from app.models.chat import Message, Thread
from app.routers.chat import _threads, _user_threads

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_chat_state() -> None:
    """Reset in-memory thread store before each test."""
    _threads.clear()
    _user_threads.clear()
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
        response = client.get("/chat/threads")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_threads_empty(self, mock_github_user):
        """Returns empty list when no threads exist."""
        response = client.get(
            "/chat/threads",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_threads_with_data(self, mock_github_user):
        """Returns all user threads."""
        # Create a thread first
        thread = Thread(
            thread_id="thread-1",
            title="First question",
            created_at="2026-04-20T12:00:00Z",
        )
        _threads[("testuser", "thread-1")] = {
            "thread": thread,
            "history": [
                Message(role="human", content="Hello"),
                Message(role="ai", content="Hi there"),
            ],
        }
        _user_threads["testuser"] = ["thread-1"]

        response = client.get(
            "/chat/threads",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["thread_id"] == "thread-1"
        assert data[0]["title"] == "First question"

    @pytest.mark.asyncio
    async def test_list_threads_multiple(self, mock_github_user):
        """Returns all threads for the user."""
        thread1 = Thread(
            thread_id="thread-1",
            title="Q1",
            created_at="2026-04-20T12:00:00Z",
        )
        thread2 = Thread(
            thread_id="thread-2",
            title="Q2",
            created_at="2026-04-20T12:01:00Z",
        )
        _threads[("testuser", "thread-1")] = {
            "thread": thread1,
            "history": [Message(role="human", content="Q1")],
        }
        _threads[("testuser", "thread-2")] = {
            "thread": thread2,
            "history": [Message(role="human", content="Q2")],
        }
        _user_threads["testuser"] = ["thread-1", "thread-2"]

        response = client.get(
            "/chat/threads",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["thread_id"] == "thread-1"
        assert data[1]["thread_id"] == "thread-2"


class TestCreateThread:
    """Test POST /chat/threads."""

    def test_requires_authentication(self):
        """Unauthenticated requests return 401."""
        response = client.post(
            "/chat/threads",
            json={"content": "Hello", "article_content": "Test"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_thread(self, mock_github_user):
        """Creates a new thread and sends initial message."""
        with patch("app.routers.chat.graph") as mock_graph:
            from langchain_core.messages import AIMessage

            # Mock the graph invoke to return a response
            mock_graph.invoke.return_value = {
                "messages": [
                    None,  # System message
                    None,  # Human message
                    AIMessage(content="That's a great question!"),
                ]
            }

            response = client.post(
                "/chat/threads",
                json={"content": "Hello", "article_content": "Test article"},
                cookies={"gh_access_token": "test_token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["thread_id"]
            assert data["created_at"]
            assert data["title"] == "Hello"  # First message is the title

    @pytest.mark.asyncio
    async def test_create_multiple_threads(self, mock_github_user):
        """Can create multiple threads."""
        with patch("app.routers.chat.graph") as mock_graph:
            from langchain_core.messages import AIMessage

            mock_graph.invoke.return_value = {
                "messages": [None, None, AIMessage(content="Response")]
            }

            response1 = client.post(
                "/chat/threads",
                json={"content": "First", "article_content": "Test"},
                cookies={"gh_access_token": "test_token"},
            )
            response2 = client.post(
                "/chat/threads",
                json={"content": "Second", "article_content": "Test"},
                cookies={"gh_access_token": "test_token"},
            )

            assert response1.status_code == 200
            assert response2.status_code == 200

            data1 = response1.json()
            data2 = response2.json()
            assert data1["thread_id"] != data2["thread_id"]

            # Both should be stored
            response_list = client.get(
                "/chat/threads",
                cookies={"gh_access_token": "test_token"},
            )
            assert len(response_list.json()) == 2


class TestGetThread:
    """Test GET /chat/threads/{thread_id}."""

    def test_requires_authentication(self):
        """Unauthenticated requests return 401."""
        response = client.get("/chat/threads/thread-1")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_thread_not_found(self, mock_github_user):
        """Returns 404 when thread does not exist."""
        response = client.get(
            "/chat/threads/nonexistent",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_thread_detail(self, mock_github_user):
        """Returns thread with full history."""
        thread = Thread(
            thread_id="thread-1",
            title="First message",
            created_at="2026-04-20T12:00:00Z",
        )
        history = [
            Message(role="human", content="Hello"),
            Message(role="ai", content="Hi there"),
        ]
        _threads[("testuser", "thread-1")] = {
            "thread": thread,
            "history": history,
        }
        _user_threads["testuser"] = ["thread-1"]

        response = client.get(
            "/chat/threads/thread-1",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["thread_id"] == "thread-1"
        assert data["title"] == "First message"
        assert len(data["history"]) == 2
        assert data["history"][0]["role"] == "human"
        assert data["history"][1]["role"] == "ai"


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
    async def test_send_message_success(self, mock_github_user):
        """Sends a message and receives a response."""
        thread = Thread(
            thread_id="thread-1",
            title="First message",
            created_at="2026-04-20T12:00:00Z",
        )
        history = [
            Message(role="human", content="Hello"),
            Message(role="ai", content="Hi there"),
        ]
        _threads[("testuser", "thread-1")] = {
            "thread": thread,
            "history": history,
        }
        _user_threads["testuser"] = ["thread-1"]

        with patch("app.routers.chat.graph") as mock_graph:
            from langchain_core.messages import AIMessage

            mock_graph.invoke.return_value = {
                "messages": [None, None, AIMessage(content="That's nice!")]
            }

            response = client.post(
                "/chat/threads/thread-1/messages",
                json={"content": "Nice to meet you", "article_content": "Test"},
                cookies={"gh_access_token": "test_token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["thread_id"] == "thread-1"
            assert data["reply"] == "That's nice!"
            assert len(data["history"]) == 4  # Previous 2 + new exchange


class TestMultipleUsers:
    """Test thread isolation between users."""

    @pytest.mark.asyncio
    async def test_users_see_only_own_threads(self, mock_github_user):
        """Users can only see their own threads."""
        # Create threads for different users
        thread1 = Thread(
            thread_id="thread-1",
            title="User1 thread",
            created_at="2026-04-20T12:00:00Z",
        )
        thread2 = Thread(
            thread_id="thread-2",
            title="User2 thread",
            created_at="2026-04-20T12:01:00Z",
        )
        _threads[("testuser", "thread-1")] = {
            "thread": thread1,
            "history": [Message(role="human", content="Hello")],
        }
        _threads[("otheruser", "thread-2")] = {
            "thread": thread2,
            "history": [Message(role="human", content="Hi")],
        }
        _user_threads["testuser"] = ["thread-1"]
        _user_threads["otheruser"] = ["thread-2"]

        response = client.get(
            "/chat/threads",
            cookies={"gh_access_token": "test_token"},
        )
        data = response.json()
        assert len(data) == 1
        assert data[0]["thread_id"] == "thread-1"
