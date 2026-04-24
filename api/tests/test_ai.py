"""Tests for AI chat endpoints and service layer."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.ai import service as ai_service
from app.main_rest import app
from app.models.ai import ChatResponse, ThreadDetail

TOKEN = "test-token"
COOKIE_HEADER = {"Cookie": f"gh_access_token={TOKEN}"}


@pytest.fixture(autouse=True)
def reset_threads() -> None:
    """Clear thread state between tests."""
    ai_service._threads.clear()
    yield
    ai_service._threads.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Service layer: list_threads
# ---------------------------------------------------------------------------


class TestListThreads:
    def test_returns_empty_list_when_no_threads(self) -> None:
        result = ai_service.list_threads()
        assert result == []

    def test_returns_thread_previews(self) -> None:
        ai_service._threads["abc"] = {"preview": "Hello world"}
        result = ai_service.list_threads()
        assert len(result) == 1
        assert result[0].thread_id == "abc"
        assert result[0].preview == "Hello world"

    def test_returns_all_threads(self) -> None:
        ai_service._threads["t1"] = {"preview": "Thread one"}
        ai_service._threads["t2"] = {"preview": "Thread two"}
        result = ai_service.list_threads()
        assert len(result) == 2


# ---------------------------------------------------------------------------
# Service layer: get_thread
# ---------------------------------------------------------------------------


class TestGetThread:
    def test_returns_thread_detail_with_messages(self) -> None:
        ai_service._threads["t1"] = {"preview": "Hello world"}

        mock_human = MagicMock()
        mock_human.__class__.__name__ = "HumanMessage"
        mock_human.content = "Hello world"

        mock_ai = MagicMock()
        mock_ai.__class__.__name__ = "AIMessage"
        mock_ai.content = "Hi there"

        mock_state = MagicMock()
        mock_state.values = {"messages": [mock_human, mock_ai]}

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.get_state.return_value = mock_state
            result = ai_service.get_thread("t1")

        assert isinstance(result, ThreadDetail)
        assert result.thread_id == "t1"
        assert result.preview == "Hello world"
        assert len(result.messages) == 2
        assert result.messages[0].role == "user"
        assert result.messages[0].content == "Hello world"
        assert result.messages[1].role == "assistant"
        assert result.messages[1].content == "Hi there"

    def test_raises_key_error_for_unknown_thread(self) -> None:
        with pytest.raises(KeyError, match="not found"):
            ai_service.get_thread("nonexistent")

    def test_returns_empty_messages_when_no_checkpoint(self) -> None:
        ai_service._threads["t1"] = {"preview": "First message"}

        mock_state = MagicMock()
        mock_state.values = {}

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.get_state.return_value = mock_state
            result = ai_service.get_thread("t1")

        assert result.messages == []

    def test_returns_empty_messages_when_state_is_none(self) -> None:
        ai_service._threads["t1"] = {"preview": "First message"}

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.get_state.return_value = None
            result = ai_service.get_thread("t1")

        assert result.messages == []

    def test_skips_messages_of_unknown_type(self) -> None:
        ai_service._threads["t1"] = {"preview": "Test"}

        mock_system = MagicMock()
        mock_system.__class__.__name__ = "SystemMessage"
        mock_system.content = "System prompt"

        mock_human = MagicMock()
        mock_human.__class__.__name__ = "HumanMessage"
        mock_human.content = "User question"

        mock_state = MagicMock()
        mock_state.values = {"messages": [mock_system, mock_human]}

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.get_state.return_value = mock_state
            result = ai_service.get_thread("t1")

        assert len(result.messages) == 1
        assert result.messages[0].role == "user"


# ---------------------------------------------------------------------------
# Service layer: create_thread
# ---------------------------------------------------------------------------


class TestCreateThread:
    @pytest.mark.asyncio
    async def test_creates_thread_and_returns_reply(self) -> None:
        with patch("app.ai.service._invoke_graph", new=AsyncMock(return_value="AI reply")):
            response = await ai_service.create_thread("Hello")

        assert isinstance(response, ChatResponse)
        assert response.reply == "AI reply"
        assert response.thread_id in ai_service._threads

    @pytest.mark.asyncio
    async def test_stores_message_as_preview(self) -> None:
        with patch("app.ai.service._invoke_graph", new=AsyncMock(return_value="Reply")):
            response = await ai_service.create_thread("My question")

        assert ai_service._threads[response.thread_id]["preview"] == "My question"

    @pytest.mark.asyncio
    async def test_raises_and_logs_on_graph_failure(self) -> None:
        with patch("app.ai.service._invoke_graph", new=AsyncMock(side_effect=RuntimeError("boom"))):
            with pytest.raises(RuntimeError, match="boom"):
                await ai_service.create_thread("Hello")


# ---------------------------------------------------------------------------
# Service layer: add_message
# ---------------------------------------------------------------------------


class TestAddMessage:
    @pytest.mark.asyncio
    async def test_adds_message_to_existing_thread(self) -> None:
        ai_service._threads["thread-1"] = {"preview": "Initial"}
        with patch("app.ai.service._invoke_graph", new=AsyncMock(return_value="Follow-up reply")):
            response = await ai_service.add_message("thread-1", "Follow-up")

        assert response.thread_id == "thread-1"
        assert response.reply == "Follow-up reply"

    @pytest.mark.asyncio
    async def test_raises_key_error_for_unknown_thread(self) -> None:
        with pytest.raises(KeyError, match="not found"):
            await ai_service.add_message("nonexistent", "Hello")

    @pytest.mark.asyncio
    async def test_raises_and_logs_on_graph_failure(self) -> None:
        ai_service._threads["thread-1"] = {"preview": "Initial"}
        with patch(
            "app.ai.service._invoke_graph", new=AsyncMock(side_effect=ValueError("graph error"))
        ):
            with pytest.raises(ValueError, match="graph error"):
                await ai_service.add_message("thread-1", "Message")


# ---------------------------------------------------------------------------
# Service layer: _sync_invoke_graph
# ---------------------------------------------------------------------------


class TestSyncInvokeGraph:
    def test_extracts_content_from_message_object(self) -> None:
        mock_message = MagicMock()
        mock_message.content = "Response text"
        mock_result = {"messages": [mock_message]}

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.invoke.return_value = mock_result
            result = ai_service._sync_invoke_graph("t1", "Hello")

        assert result == "Response text"

    def test_extracts_content_from_dict_message(self) -> None:
        mock_msg_dict = {"content": "Dict response"}
        mock_result = {"messages": [mock_msg_dict]}

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.invoke.return_value = mock_result
            result = ai_service._sync_invoke_graph("t1", "Hello")

        assert result == "Dict response"

    def test_returns_empty_string_when_no_messages(self) -> None:
        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.invoke.return_value = {"messages": []}
            result = ai_service._sync_invoke_graph("t1", "Hello")

        assert result == ""


# ---------------------------------------------------------------------------
# REST endpoints: GET /ai/threads
# ---------------------------------------------------------------------------


class TestGetThreadsEndpoint:
    def test_returns_empty_list_when_no_threads(self, client: TestClient) -> None:
        response = client.get("/ai/threads", headers=COOKIE_HEADER)
        assert response.status_code == 200
        assert response.json() == []

    def test_returns_thread_list(self, client: TestClient) -> None:
        ai_service._threads["t1"] = {"preview": "Test thread"}
        response = client.get("/ai/threads", headers=COOKIE_HEADER)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["thread_id"] == "t1"
        assert data[0]["preview"] == "Test thread"

    def test_requires_authentication(self, client: TestClient) -> None:
        response = client.get("/ai/threads")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# REST endpoints: GET /ai/threads/{thread_id}
# ---------------------------------------------------------------------------


class TestGetThreadDetailEndpoint:
    def test_returns_thread_with_messages(self, client: TestClient) -> None:
        detail = ThreadDetail(
            thread_id="t1",
            preview="Hello",
            messages=[
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there"},
            ],
        )
        with patch("app.routers.ai.get_thread", return_value=detail):
            response = client.get("/ai/threads/t1", headers=COOKIE_HEADER)

        assert response.status_code == 200
        data = response.json()
        assert data["thread_id"] == "t1"
        assert data["preview"] == "Hello"
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"

    def test_returns_404_for_unknown_thread(self, client: TestClient) -> None:
        with patch("app.routers.ai.get_thread", side_effect=KeyError("not found")):
            response = client.get("/ai/threads/unknown", headers=COOKIE_HEADER)

        assert response.status_code == 404

    def test_returns_empty_messages_for_new_thread(self, client: TestClient) -> None:
        detail = ThreadDetail(thread_id="t1", preview="First question", messages=[])
        with patch("app.routers.ai.get_thread", return_value=detail):
            response = client.get("/ai/threads/t1", headers=COOKIE_HEADER)

        assert response.status_code == 200
        assert response.json()["messages"] == []

    def test_requires_authentication(self, client: TestClient) -> None:
        response = client.get("/ai/threads/t1")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# REST endpoints: POST /ai/threads
# ---------------------------------------------------------------------------


class TestCreateThreadEndpoint:
    def test_creates_thread_successfully(self, client: TestClient) -> None:
        with patch(
            "app.routers.ai.create_thread",
            new=AsyncMock(return_value=ChatResponse(thread_id="new-thread", reply="Hello back")),
        ):
            response = client.post(
                "/ai/threads",
                json={"message": "Hello"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["thread_id"] == "new-thread"
        assert data["reply"] == "Hello back"

    def test_returns_422_for_empty_message(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads",
            json={"message": "   "},
            headers=COOKIE_HEADER,
        )
        assert response.status_code == 422

    def test_returns_500_on_service_failure(self, client: TestClient) -> None:
        with patch(
            "app.routers.ai.create_thread",
            new=AsyncMock(side_effect=RuntimeError("Service unavailable")),
        ):
            response = client.post(
                "/ai/threads",
                json={"message": "Hello"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 500
        assert "Failed to get AI response" in response.json()["detail"]

    def test_requires_authentication(self, client: TestClient) -> None:
        response = client.post("/ai/threads", json={"message": "Hello"})
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# REST endpoints: POST /ai/threads/{thread_id}
# ---------------------------------------------------------------------------


class TestSendMessageEndpoint:
    def test_sends_message_to_existing_thread(self, client: TestClient) -> None:
        with patch(
            "app.routers.ai.add_message",
            new=AsyncMock(return_value=ChatResponse(thread_id="t1", reply="Follow-up reply")),
        ):
            response = client.post(
                "/ai/threads/t1",
                json={"message": "Follow-up"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["reply"] == "Follow-up reply"

    def test_returns_422_for_empty_message(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads/t1",
            json={"message": ""},
            headers=COOKIE_HEADER,
        )
        assert response.status_code == 422

    def test_returns_404_for_unknown_thread(self, client: TestClient) -> None:
        with patch(
            "app.routers.ai.add_message",
            new=AsyncMock(side_effect=KeyError("Thread t1 not found")),
        ):
            response = client.post(
                "/ai/threads/unknown-thread",
                json={"message": "Hello"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 404

    def test_returns_500_on_service_failure(self, client: TestClient) -> None:
        with patch(
            "app.routers.ai.add_message",
            new=AsyncMock(side_effect=RuntimeError("Service error")),
        ):
            response = client.post(
                "/ai/threads/t1",
                json={"message": "Hello"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 500
        assert "Failed to get AI response" in response.json()["detail"]

    def test_requires_authentication(self, client: TestClient) -> None:
        response = client.post("/ai/threads/t1", json={"message": "Hello"})
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Graph layer: _get_model (lazy initialization)
# ---------------------------------------------------------------------------


class TestGetModel:
    def test_lazy_initializes_model(self) -> None:
        import app.ai.graph as graph_module

        original = graph_module._model
        try:
            graph_module._model = None
            with patch("app.ai.graph.ChatAnthropic") as mock_cls:
                mock_instance = MagicMock()
                mock_cls.return_value = mock_instance
                result = graph_module._get_model()
            assert result is mock_instance
        finally:
            graph_module._model = original

    def test_reuses_existing_model(self) -> None:
        import app.ai.graph as graph_module

        original = graph_module._model
        try:
            mock_model = MagicMock()
            graph_module._model = mock_model
            result = graph_module._get_model()
            assert result is mock_model
        finally:
            graph_module._model = original
