from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.main_rest import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


TOKEN = "test-token"
COOKIE_HEADER = {"Cookie": f"gh_access_token={TOKEN}"}


# Reset module-level _threads dict before each test
@pytest.fixture(autouse=True)
def reset_threads() -> None:
    """Reset the in-memory thread storage before each test."""
    from app.ai import service

    service._threads.clear()
    yield


# ---------------------------------------------------------------------------
# GET /ai/threads — List threads for an article
# ---------------------------------------------------------------------------


class TestListThreads:
    def test_returns_empty_list_when_no_threads(self, client: TestClient) -> None:
        response = client.get("/ai/threads?slug=test-article", headers=COOKIE_HEADER)

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_401_when_no_cookie(self, client: TestClient) -> None:
        response = client.get("/ai/threads?slug=test-article")

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_filters_threads_by_slug(self, client: TestClient) -> None:
        # Create threads for different slugs
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="reply")]},
        ):
            response1 = client.post(
                "/ai/threads",
                json={
                    "slug": "article-one",
                    "message": "Hello",
                    "article_content": "content",
                },
                headers=COOKIE_HEADER,
            )
            response2 = client.post(
                "/ai/threads",
                json={
                    "slug": "article-two",
                    "message": "Hi",
                    "article_content": "content",
                },
                headers=COOKIE_HEADER,
            )

        assert response1.status_code == 201
        assert response2.status_code == 201

        # List threads for article-one only
        response = client.get("/ai/threads?slug=article-one", headers=COOKIE_HEADER)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["slug"] == "article-one"

    def test_threads_sorted_by_created_at_descending(self, client: TestClient) -> None:
        # Create two threads with mocked graph calls
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="reply")]},
        ):
            client.post(
                "/ai/threads",
                json={
                    "slug": "article-one",
                    "message": "First",
                    "article_content": "content",
                },
                headers=COOKIE_HEADER,
            )
            client.post(
                "/ai/threads",
                json={
                    "slug": "article-one",
                    "message": "Second",
                    "article_content": "content",
                },
                headers=COOKIE_HEADER,
            )

        response = client.get("/ai/threads?slug=article-one", headers=COOKIE_HEADER)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Most recent first
        assert data[0]["title"] == "Second"
        assert data[1]["title"] == "First"

    def test_does_not_return_threads_of_other_users(self, client: TestClient) -> None:
        token1 = "user1-token"
        token2 = "user2-token"
        headers1 = {"Cookie": f"gh_access_token={token1}"}
        headers2 = {"Cookie": f"gh_access_token={token2}"}

        # User 1 creates a thread
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="reply")]},
        ):
            client.post(
                "/ai/threads",
                json={
                    "slug": "article-one",
                    "message": "User 1 message",
                    "article_content": "content",
                },
                headers=headers1,
            )

        # User 2 lists threads — should see nothing
        response = client.get("/ai/threads?slug=article-one", headers=headers2)

        assert response.status_code == 200
        assert response.json() == []


# ---------------------------------------------------------------------------
# POST /ai/threads — Create a new thread
# ---------------------------------------------------------------------------


class TestCreateThread:
    def test_creates_thread_returns_201_and_reply(self, client: TestClient) -> None:
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="Assistant reply")]},
        ):
            response = client.post(
                "/ai/threads",
                json={
                    "slug": "test-article",
                    "message": "Tell me about this article",
                    "article_content": "Article content here",
                },
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 201
        data = response.json()
        assert "thread_id" in data
        assert data["reply"] == "Assistant reply"

    def test_returns_401_when_no_cookie(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads",
            json={
                "slug": "test-article",
                "message": "Hello",
                "article_content": "content",
            },
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_returns_422_when_message_is_empty(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads",
            json={
                "slug": "test-article",
                "message": "",
                "article_content": "content",
            },
            headers=COOKIE_HEADER,
        )

        assert response.status_code == 422
        assert "Message cannot be empty" in response.json()["detail"]

    def test_returns_422_when_message_is_whitespace(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads",
            json={
                "slug": "test-article",
                "message": "   ",
                "article_content": "content",
            },
            headers=COOKIE_HEADER,
        )

        assert response.status_code == 422

    def test_invokes_graph_with_correct_system_prompt(self, client: TestClient) -> None:
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="reply")]},
        ) as mock_invoke:
            client.post(
                "/ai/threads",
                json={
                    "slug": "test-article",
                    "message": "Hello",
                    "article_content": "My Article Content",
                },
                headers=COOKIE_HEADER,
            )

        # Verify graph.invoke was called
        mock_invoke.assert_called_once()
        call_args = mock_invoke.call_args
        messages = call_args[0][0]["messages"]

        # First message should be system prompt with article content
        assert messages[0].content == (
            "You are a writing cowriter assistant for the article below.\n"
            "Help the author improve, expand, or discuss their work.\n\n"
            "--- ARTICLE CONTENT ---\n"
            "My Article Content\n"
            "--- END ARTICLE ---"
        )


# ---------------------------------------------------------------------------
# POST /ai/threads/{thread_id} — Post a message to existing thread
# ---------------------------------------------------------------------------


class TestPostMessage:
    def test_posts_message_and_returns_reply(self, client: TestClient) -> None:
        # Create a thread first
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="initial reply")]},
        ):
            create_response = client.post(
                "/ai/threads",
                json={
                    "slug": "test-article",
                    "message": "First message",
                    "article_content": "content",
                },
                headers=COOKIE_HEADER,
            )

        thread_id = create_response.json()["thread_id"]

        # Post a new message to the thread
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="follow-up reply")]},
        ):
            response = client.post(
                f"/ai/threads/{thread_id}",
                json={
                    "message": "Follow-up question",
                    "article_content": "updated content",
                },
                headers=COOKIE_HEADER,
            )

        assert response.status_code == 200
        assert response.json()["reply"] == "follow-up reply"

    def test_returns_401_when_no_cookie(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads/unknown-thread",
            json={
                "message": "Hello",
                "article_content": "content",
            },
        )

        assert response.status_code == 401

    def test_returns_404_for_unknown_thread_id(self, client: TestClient) -> None:
        response = client.post(
            "/ai/threads/does-not-exist",
            json={
                "message": "Hello",
                "article_content": "content",
            },
            headers=COOKIE_HEADER,
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Thread not found"

    def test_returns_422_when_message_is_empty(self, client: TestClient) -> None:
        # Create a thread first
        with patch(
            "app.ai.service.graph.invoke",
            return_value={"messages": [AIMessage(content="reply")]},
        ):
            create_response = client.post(
                "/ai/threads",
                json={
                    "slug": "test-article",
                    "message": "First message",
                    "article_content": "content",
                },
                headers=COOKIE_HEADER,
            )

        thread_id = create_response.json()["thread_id"]

        # Try to post empty message
        response = client.post(
            f"/ai/threads/{thread_id}",
            json={
                "message": "",
                "article_content": "content",
            },
            headers=COOKIE_HEADER,
        )

        assert response.status_code == 422
