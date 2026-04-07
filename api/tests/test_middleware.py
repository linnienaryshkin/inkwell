"""Tests for shared middleware and error handlers."""

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.shared.middleware import setup_error_handlers


def test_github_http_error_handler():
    """GitHub HTTPStatusError is converted to 502 response."""
    app = FastAPI()
    setup_error_handlers(app)

    @app.get("/test")
    async def test_endpoint():
        response = httpx.Response(500, request=httpx.Request("GET", "https://api.github.com"))
        raise httpx.HTTPStatusError("github error", request=response.request, response=response)

    client = TestClient(app)
    response = client.get("/test")

    assert response.status_code == 502
    assert "GitHub API error" in response.json()["detail"]
    assert "500" in response.json()["detail"]


def test_value_error_handler():
    """ValueError is converted to 502 response."""
    app = FastAPI()
    setup_error_handlers(app)

    @app.get("/test")
    async def test_endpoint():
        raise ValueError("Malformed data")

    client = TestClient(app)
    response = client.get("/test")

    assert response.status_code == 502
    assert "Malformed data" in response.json()["detail"]
