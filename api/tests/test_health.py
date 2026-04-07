"""Tests for health check endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main_rest import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check_returns_200(client: TestClient):
    """Health check endpoint returns 200 with status message."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Inkwell REST API server is up"}


def test_health_check_returns_success_message(client: TestClient):
    """Health check response contains expected message format."""
    response = client.get("/")
    data = response.json()
    assert "message" in data
    assert "up" in data["message"].lower()
