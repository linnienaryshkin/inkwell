"""Tests for AI chat endpoints and service layer."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.ai import service as ai_service
from app.main_rest import app
from app.models.ai import ChatMessage, ChatResponse, ThreadDetail

TOKEN = "test-token"
COOKIE_HEADER = {"Cookie": f"gh_access_token={TOKEN}"}

THREAD_UUID = "00000000-0000-0000-0000-000000000001"
THREAD_UUID_2 = "00000000-0000-0000-0000-000000000002"


def _make_checkpoint_tuple(thread_id: str) -> MagicMock:
    """Build a minimal CheckpointTuple mock for a given thread_id."""
    cp = MagicMock()
    cp.config = {"configurable": {"thread_id": thread_id}}
    return cp


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Service layer: list_threads
# ---------------------------------------------------------------------------


class TestListThreads:
    def test_returns_empty_list_when_no_threads(self) -> None:
        with patch("app.ai.service.checkpointer") as mock_cp:
            mock_cp.list.return_value = []
            result = ai_service.list_threads()
        assert result == []

    def test_returns_thread_previews(self) -> None:
        mock_human = MagicMock()
        mock_human.__class__.__name__ = "HumanMessage"
        mock_human.content = "Hello world"

        mock_state = MagicMock()
        mock_state.values = {"messages": [mock_human]}

        with (
            patch("app.ai.service.checkpointer") as mock_cp,
            patch("app.ai.service.graph") as mock_graph,
        ):
            mock_cp.list.return_value = [_make_checkpoint_tuple("abc")]
            mock_graph.get_state.return_value = mock_state
            result = ai_service.list_threads()

        assert len(result) == 1
        assert result[0].thread_id == "abc"
        assert result[0].preview == "Hello world"

    def test_returns_all_threads(self) -> None:
        mock_state = MagicMock()
        mock_state.values = {"messages": []}

        with (
            patch("app.ai.service.checkpointer") as mock_cp,
            patch("app.ai.service.graph") as mock_graph,
        ):
            mock_cp.list.return_value = [
                _make_checkpoint_tuple("t1"),
                _make_checkpoint_tuple("t2"),
            ]
            mock_graph.get_state.return_value = mock_state
            result = ai_service.list_threads()

        assert len(result) == 2

    def test_deduplicates_threads(self) -> None:
        """Multiple checkpoints for the same thread should produce one entry."""
        mock_state = MagicMock()
        mock_state.values = {"messages": []}

        with (
            patch("app.ai.service.checkpointer") as mock_cp,
            patch("app.ai.service.graph") as mock_graph,
        ):
            mock_cp.list.return_value = [
                _make_checkpoint_tuple("t1"),
                _make_checkpoint_tuple("t1"),
            ]
            mock_graph.get_state.return_value = mock_state
            result = ai_service.list_threads()

        assert len(result) == 1


# ---------------------------------------------------------------------------
# Service layer: get_thread
# ---------------------------------------------------------------------------


class TestGetThread:
    def test_returns_thread_detail_with_messages(self) -> None:
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
        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.get_state.return_value = None
            with pytest.raises(KeyError, match="not found"):
                ai_service.get_thread("nonexistent")

    def test_raises_key_error_when_state_has_no_values(self) -> None:
        mock_state = MagicMock()
        mock_state.values = {}

        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.get_state.return_value = mock_state
            with pytest.raises(KeyError, match="not found"):
                ai_service.get_thread("t1")

    def test_skips_messages_of_unknown_type(self) -> None:
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
        assert response.thread_id is not None

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
        mock_state = MagicMock()
        mock_state.values = {"messages": [MagicMock()]}

        with (
            patch("app.ai.service.graph") as mock_graph,
            patch("app.ai.service._invoke_graph", new=AsyncMock(return_value="Follow-up reply")),
        ):
            mock_graph.get_state.return_value = mock_state
            response = await ai_service.add_message("thread-1", "Follow-up")

        assert response.thread_id == "thread-1"
        assert response.reply == "Follow-up reply"

    @pytest.mark.asyncio
    async def test_raises_key_error_for_unknown_thread(self) -> None:
        with patch("app.ai.service.graph") as mock_graph:
            mock_graph.get_state.return_value = None
            with pytest.raises(KeyError, match="not found"):
                await ai_service.add_message("nonexistent", "Hello")

    @pytest.mark.asyncio
    async def test_raises_and_logs_on_graph_failure(self) -> None:
        mock_state = MagicMock()
        mock_state.values = {"messages": [MagicMock()]}

        with (
            patch("app.ai.service.graph") as mock_graph,
            patch(
                "app.ai.service._invoke_graph", new=AsyncMock(side_effect=ValueError("graph error"))
            ),
        ):
            mock_graph.get_state.return_value = mock_state
            with pytest.raises(ValueError, match="graph error"):
                await ai_service.add_message("thread-1", "Message")


# ---------------------------------------------------------------------------
# REST endpoints: GET /ai/threads
# ---------------------------------------------------------------------------


class TestGetThreadsEndpoint:
    def test_returns_empty_list_when_no_threads(self, client: TestClient) -> None:
        with patch("app.ai.service.checkpointer") as mock_cp:
            mock_cp.list.return_value = []
            response = client.get("/ai/threads", headers=COOKIE_HEADER)
        assert response.status_code == 200
        assert response.json() == []

    def test_returns_thread_list(self, client: TestClient) -> None:
        mock_human = MagicMock()
        mock_human.__class__.__name__ = "HumanMessage"
        mock_human.content = "Test thread"

        mock_state = MagicMock()
        mock_state.values = {"messages": [mock_human]}

        with (
            patch("app.ai.service.checkpointer") as mock_cp,
            patch("app.ai.service.graph") as mock_graph,
        ):
            mock_cp.list.return_value = [_make_checkpoint_tuple("t1")]
            mock_graph.get_state.return_value = mock_state
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
            thread_id=THREAD_UUID,
            preview="Hello",
            messages=[
                ChatMessage(role="user", content="Hello"),
                ChatMessage(role="assistant", content="Hi there"),
            ],
        )
        with patch("app.routers.ai.get_thread", return_value=detail):
            response = client.get(f"/ai/threads/{THREAD_UUID}", headers=COOKIE_HEADER)

        assert response.status_code == 200
        data = response.json()
        assert data["thread_id"] == THREAD_UUID
        assert data["preview"] == "Hello"
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"

    def test_returns_422_for_non_uuid_thread_id(self, client: TestClient) -> None:
        response = client.get("/ai/threads/not-a-uuid", headers=COOKIE_HEADER)
        assert response.status_code == 422

    def test_returns_404_for_unknown_thread(self, client: TestClient) -> None:
        with patch("app.routers.ai.get_thread", side_effect=KeyError("not found")):
            response = client.get(f"/ai/threads/{THREAD_UUID}", headers=COOKIE_HEADER)

        assert response.status_code == 404

    def test_returns_empty_messages_for_new_thread(self, client: TestClient) -> None:
        detail = ThreadDetail(thread_id=THREAD_UUID, preview="First question", messages=[])
        with patch("app.routers.ai.get_thread", return_value=detail):
            response = client.get(f"/ai/threads/{THREAD_UUID}", headers=COOKIE_HEADER)

        assert response.status_code == 200
        assert response.json()["messages"] == []

    def test_requires_authentication(self, client: TestClient) -> None:
        response = client.get(f"/ai/threads/{THREAD_UUID}")
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
            new=AsyncMock(
                return_value=ChatResponse(thread_id=THREAD_UUID, reply="Follow-up reply")
            ),
        ):
            response = client.post(
                f"/ai/threads/{THREAD_UUID}",
                json={"message": "Follow-up"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["reply"] == "Follow-up reply"

    def test_returns_422_for_empty_message(self, client: TestClient) -> None:
        response = client.post(
            f"/ai/threads/{THREAD_UUID}",
            json={"message": ""},
            headers=COOKIE_HEADER,
        )
        assert response.status_code == 422

    def test_returns_422_for_non_uuid_thread_id(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads/not-a-uuid",
            json={"message": "Hello"},
            headers=COOKIE_HEADER,
        )
        assert response.status_code == 422

    def test_returns_404_for_unknown_thread(self, client: TestClient) -> None:
        with patch(
            "app.routers.ai.add_message",
            new=AsyncMock(side_effect=KeyError(f"Thread {THREAD_UUID} not found")),
        ):
            response = client.post(
                f"/ai/threads/{THREAD_UUID}",
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
                f"/ai/threads/{THREAD_UUID}",
                json={"message": "Hello"},
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 500
        assert "Failed to get AI response" in response.json()["detail"]

    def test_requires_authentication(self, client: TestClient) -> None:
        response = client.post(f"/ai/threads/{THREAD_UUID}", json={"message": "Hello"})
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Graph layer: _get_model (lazy initialization)
# ---------------------------------------------------------------------------


class TestGetModel:
    def test_constructs_model_exactly_once_across_two_calls(self) -> None:
        import app.ai.graph as graph_module

        with patch("app.ai.graph.ChatAnthropic") as mock_cls:
            mock_cls.return_value = MagicMock()
            # Reset to force construction
            original = graph_module._model
            graph_module._model = None
            try:
                graph_module._get_model()
                graph_module._get_model()
            finally:
                graph_module._model = original

        assert mock_cls.call_count == 1
