import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Set required env vars before importing the app
os.environ.setdefault("GITHUB_CLIENT_ID", "test_client_id")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "test_client_secret")
os.environ.setdefault("GITHUB_CALLBACK_URL", "http://localhost:8000/auth/callback")
os.environ.setdefault("SESSION_SECRET", "test_session_secret")
os.environ.setdefault("ENVIRONMENT", "development")

from app.models.auth import SessionData  # noqa: E402
from app.routers.auth import _sign_session  # noqa: E402


@pytest.fixture()
def client():
    from app.main import app
    return TestClient(app, follow_redirects=False)


def _make_session(
    login: str = "octocat",
    name: str | None = "The Octocat",
    avatar_url: str = "https://github.com/images/error/octocat_happy.gif",
    access_token: str = "gho_test_token",
) -> str:
    session = SessionData(
        access_token=access_token,
        login=login,
        name=name,
        avatar_url=avatar_url,
    )
    return _sign_session(session)


# --- /auth/login ---

def test_login_redirects_to_github(client):
    response = client.get("/auth/login")
    assert response.status_code == 307
    location = response.headers["location"]
    assert "github.com/login/oauth/authorize" in location
    assert "client_id=test_client_id" in location
    assert "scope=read%3Auser" in location


def test_login_sets_state_cookie(client):
    response = client.get("/auth/login")
    assert STATE_COOKIE in response.cookies or "gh_oauth_state" in response.headers.get("set-cookie", "")


STATE_COOKIE = "gh_oauth_state"
SESSION_COOKIE = "inkwell_session"


# --- /auth/callback ---

def test_callback_missing_state_returns_400(client):
    client.cookies.set(STATE_COOKIE, "some_state")
    response = client.get("/auth/callback?code=abc&state=wrong_state")
    assert response.status_code == 400


def test_callback_no_state_cookie_returns_400(client):
    response = client.get("/auth/callback?code=abc&state=some_state")
    assert response.status_code == 400


def _mock_httpx_client(access_token: str = "gho_test_token", user_data: dict | None = None):
    if user_data is None:
        user_data = {
            "login": "octocat",
            "name": "The Octocat",
            "avatar_url": "https://github.com/images/error/octocat_happy.gif",
        }

    token_response = MagicMock()
    token_response.raise_for_status = MagicMock()
    token_response.json.return_value = {"access_token": access_token}

    user_response = MagicMock()
    user_response.raise_for_status = MagicMock()
    user_response.json.return_value = user_data

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=token_response)
    mock_client.get = AsyncMock(return_value=user_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@patch("app.routers.auth.httpx.AsyncClient")
def test_callback_valid_state_sets_session_cookie(mock_async_client, client):
    mock_async_client.return_value = _mock_httpx_client()
    state = "valid_state_value"
    client.cookies.set(STATE_COOKIE, state)
    response = client.get(f"/auth/callback?code=abc&state={state}")
    assert response.status_code == 307
    assert SESSION_COOKIE in response.cookies or SESSION_COOKIE in response.headers.get("set-cookie", "")


@patch("app.routers.auth.httpx.AsyncClient")
def test_callback_no_access_token_returns_400(mock_async_client, client):
    token_response = MagicMock()
    token_response.raise_for_status = MagicMock()
    token_response.json.return_value = {"error": "bad_verification_code"}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=token_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_async_client.return_value = mock_client

    state = "valid_state_value"
    client.cookies.set(STATE_COOKIE, state)
    response = client.get(f"/auth/callback?code=bad_code&state={state}")
    assert response.status_code == 400


# --- /auth/me ---

def test_me_no_cookie_returns_401(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_me_invalid_cookie_returns_401(client):
    client.cookies.set(SESSION_COOKIE, "invalid.token.value")
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_valid_cookie_returns_profile(client):
    token = _make_session()
    client.cookies.set(SESSION_COOKIE, token)
    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["login"] == "octocat"
    assert data["name"] == "The Octocat"
    assert "avatar_url" in data


# --- /auth/refresh ---

def test_refresh_no_cookie_returns_401(client):
    response = client.get("/auth/refresh")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_refresh_valid_cookie_reissues_session(client):
    token = _make_session()
    client.cookies.set(SESSION_COOKIE, token)
    response = client.get("/auth/refresh")
    assert response.status_code == 200
    data = response.json()
    assert data["login"] == "octocat"
    assert SESSION_COOKIE in response.cookies or SESSION_COOKIE in response.headers.get("set-cookie", "")


def test_refresh_invalid_cookie_returns_401(client):
    client.cookies.set(SESSION_COOKIE, "garbage.token")
    response = client.get("/auth/refresh")
    assert response.status_code == 401
