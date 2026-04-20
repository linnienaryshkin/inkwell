"""Tests for chat endpoints."""

# ruff: noqa: ANN001, ANN201
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.ai.graph import memory
from app.main_rest import app
from app.routers.chat import _thread_metadata

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_chat_state() -> None:
    """Reset thread metadata and MemorySaver before each test."""
    # Clear metadata store
    _thread_metadata.clear()
    # Clear MemorySaver
    for checkpoint_tuple in list(memory.list(None)):
        if checkpoint_tuple.config and "thread_id" in checkpoint_tuple.config.get(
            "configurable", {}
        ):
            thread_id = checkpoint_tuple.config["configurable"]["thread_id"]
            memory.delete_thread(thread_id)
    yield


@pytest.fixture
def mock_github_user():  # type: ignore[no-untyped-def]
    """Mock GitHub user API response."""
    with patch("app.shared.middleware.httpx.AsyncClient") as mock_client_class:
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
        # Manually populate metadata (simulating create_thread having been called)
        _thread_metadata[("testuser", "thread-1")] = {
            "title": "First question",
            "created_at": "2026-04-20T12:00:00Z",
        }

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
        # Manually populate metadata
        _thread_metadata[("testuser", "thread-1")] = {
            "title": "Q1",
            "created_at": "2026-04-20T12:00:00Z",
        }
        _thread_metadata[("testuser", "thread-2")] = {
            "title": "Q2",
            "created_at": "2026-04-20T12:01:00Z",
        }

        response = client.get(
            "/chat/threads",
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["thread_id"] == "thread-1" or data[1]["thread_id"] == "thread-1"
        assert data[0]["thread_id"] == "thread-2" or data[1]["thread_id"] == "thread-2"


class TestCreateThread:
    """Test POST /chat/threads."""

    def test_requires_authentication(self):
        """Unauthenticated requests return 401."""
        response = client.post(
            "/chat/threads",
            json={"content": "Hello"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_thread(self, mock_github_user):
        """Creates a new thread and sends initial message."""
        with patch("app.ai.service.graph") as mock_graph:
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
                json={"content": "Hello"},
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
        with patch("app.ai.service.graph") as mock_graph:
            from langchain_core.messages import AIMessage

            mock_graph.invoke.return_value = {
                "messages": [None, None, AIMessage(content="Response")]
            }

            response1 = client.post(
                "/chat/threads",
                json={"content": "First"},
                cookies={"gh_access_token": "test_token"},
            )
            response2 = client.post(
                "/chat/threads",
                json={"content": "Second"},
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
        # Populate metadata
        _thread_metadata[("testuser", "thread-1")] = {
            "title": "First message",
            "created_at": "2026-04-20T12:00:00Z",
        }

        # Populate MemorySaver with message history via the graph
        from langchain_core.messages import AIMessage, HumanMessage

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.invoke.return_value = {
                "messages": [
                    HumanMessage(content="Hello"),
                    AIMessage(content="Hi there"),
                ]
            }

            # Call get_thread which will invoke graph for first message
            response = client.get(
                "/chat/threads/thread-1",
                cookies={"gh_access_token": "test_token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["thread_id"] == "thread-1"
        assert data["title"] == "First message"


class TestSendMessage:
    """Test POST /chat/threads/{thread_id}/messages."""

    def test_requires_authentication(self):
        """Unauthenticated requests return 401."""
        response = client.post(
            "/chat/threads/thread-1/messages",
            json={"content": "Hello"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_thread_not_found(self, mock_github_user):
        """Returns 404 when thread does not exist."""
        response = client.post(
            "/chat/threads/nonexistent/messages",
            json={"content": "Hello"},
            cookies={"gh_access_token": "test_token"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_send_message_success(self, mock_github_user):
        """Sends a message and receives a response."""
        # Populate metadata for existing thread
        _thread_metadata[("testuser", "thread-1")] = {
            "title": "First message",
            "created_at": "2026-04-20T12:00:00Z",
        }

        from langchain_core.messages import AIMessage

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.invoke.return_value = {
                "messages": [None, None, AIMessage(content="That's nice!")]
            }

            response = client.post(
                "/chat/threads/thread-1/messages",
                json={"content": "Nice to meet you"},
                cookies={"gh_access_token": "test_token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["thread_id"] == "thread-1"
            assert data["reply"] == "That's nice!"


class TestMultipleUsers:
    """Test thread isolation between users."""

    @pytest.mark.asyncio
    async def test_users_see_only_own_threads(self, mock_github_user):
        """Users can only see their own threads."""
        # Populate metadata for different users
        _thread_metadata[("testuser", "thread-1")] = {
            "title": "User1 thread",
            "created_at": "2026-04-20T12:00:00Z",
        }
        _thread_metadata[("otheruser", "thread-2")] = {
            "title": "User2 thread",
            "created_at": "2026-04-20T12:01:00Z",
        }

        response = client.get(
            "/chat/threads",
            cookies={"gh_access_token": "test_token"},
        )
        data = response.json()
        assert len(data) == 1
        assert data[0]["thread_id"] == "thread-1"
