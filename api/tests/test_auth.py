from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.routers.auth import SESSION_COOKIE, STATE_COOKIE

_VALID_REDIRECT = "http://localhost:5173/inkwell/"
_INVALID_REDIRECT = "https://evil.com"


@pytest.fixture()
def client():
    from app.main import app

    return TestClient(app, follow_redirects=False)


def _mock_github_user(
    user_data: dict | None = None,
    status_code: int = 200,
):
    if user_data is None:
        user_data = {
            "login": "octocat",
            "name": "The Octocat",
            "avatar_url": "https://github.com/images/error/octocat_happy.gif",
        }
    mock_resp = MagicMock()
    if status_code >= 400:
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "HTTP error", request=MagicMock(), response=MagicMock()
        )
    else:
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = user_data

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


def _mock_httpx_client(access_token: str = "gho_test_token"):
    token_response = MagicMock()
    token_response.raise_for_status = MagicMock()
    token_response.json.return_value = {"access_token": access_token}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=token_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


# --- /auth/login ---


def test_login_redirects_to_github(client):
    response = client.get("/auth/login")
    assert response.status_code == 307
    location = response.headers["location"]
    assert "github.com/login/oauth/authorize" in location
    assert "client_id=" in location
    assert "scope=read%3Auser" in location


def test_login_sets_state_cookie(client):
    response = client.get("/auth/login")
    assert STATE_COOKIE in response.cookies or "gh_oauth_state" in response.headers.get(
        "set-cookie", ""
    )


def test_login_with_valid_redirect_url_accepted(client):
    response = client.get(f"/auth/login?redirect_url={_VALID_REDIRECT}")
    assert response.status_code == 307
    assert STATE_COOKIE in response.cookies or STATE_COOKIE in response.headers.get(
        "set-cookie", ""
    )


def test_login_with_invalid_redirect_url_returns_400(client):
    response = client.get(f"/auth/login?redirect_url={_INVALID_REDIRECT}")
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid redirect URL"


# --- /auth/callback ---


def test_callback_missing_state_returns_400(client):
    # State cookie has "wrong_state|redirect" but query param state is different
    client.cookies.set(STATE_COOKIE, f"some_state|{_VALID_REDIRECT}")
    response = client.get("/auth/callback?code=abc&state=wrong_state")
    assert response.status_code == 400


def test_callback_no_state_cookie_returns_400(client):
    response = client.get("/auth/callback?code=abc&state=some_state")
    assert response.status_code == 400


@patch("app.routers.auth.httpx.AsyncClient")
def test_callback_valid_state_sets_session_cookie(mock_async_client, client):
    mock_async_client.return_value = _mock_httpx_client()
    state = "valid_state_value"
    client.cookies.set(STATE_COOKIE, f"{state}|{_VALID_REDIRECT}")
    response = client.get(f"/auth/callback?code=abc&state={state}")
    assert response.status_code == 307
    assert SESSION_COOKIE in response.cookies or SESSION_COOKIE in response.headers.get(
        "set-cookie", ""
    )


@patch("app.routers.auth.httpx.AsyncClient")
def test_callback_redirects_to_frontend(mock_async_client, client):
    mock_async_client.return_value = _mock_httpx_client()
    state = "valid_state_value"
    client.cookies.set(STATE_COOKIE, f"{state}|{_VALID_REDIRECT}")
    response = client.get(f"/auth/callback?code=abc&state={state}")
    assert response.status_code == 307
    assert "localhost:5173" in response.headers["location"]


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
    client.cookies.set(STATE_COOKIE, f"{state}|{_VALID_REDIRECT}")
    response = client.get(f"/auth/callback?code=bad_code&state={state}")
    assert response.status_code == 400


# --- /auth/me ---


def test_me_no_cookie_returns_401(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@patch("app.routers.auth.httpx.AsyncClient")
def test_me_valid_cookie_returns_profile(mock_async_client, client):
    mock_async_client.return_value = _mock_github_user()
    client.cookies.set(SESSION_COOKIE, "gho_test_token")
    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["login"] == "octocat"
    assert data["name"] == "The Octocat"
    assert "avatar_url" in data


@patch("app.routers.auth.httpx.AsyncClient")
def test_me_invalid_token_returns_401(mock_async_client, client):
    mock_async_client.return_value = _mock_github_user(status_code=401)
    client.cookies.set(SESSION_COOKIE, "gho_expired_token")
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


# --- /auth/logout ---

_VALID_ORIGIN = "http://localhost:5173"


def test_logout_valid_origin_returns_204(client):
    response = client.post("/auth/logout", headers={"Origin": _VALID_ORIGIN})
    assert response.status_code == 204


def test_logout_missing_origin_returns_403(client):
    response = client.post("/auth/logout")
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden"


def test_logout_invalid_origin_returns_403(client):
    response = client.post("/auth/logout", headers={"Origin": "https://evil.com"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden"


def test_logout_clears_session_cookie(client):
    client.cookies.set(SESSION_COOKIE, "gho_test_token")
    response = client.post("/auth/logout", headers={"Origin": _VALID_ORIGIN})
    assert response.status_code == 204
    assert "max-age=0" in response.headers.get("set-cookie", "").lower()


def test_logout_no_cookie_still_returns_204(client):
    response = client.post("/auth/logout", headers={"Origin": _VALID_ORIGIN})
    assert response.status_code == 204
