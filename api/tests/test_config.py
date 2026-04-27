"""Tests for configuration modules."""

import os
from unittest.mock import patch

import pytest

from app.shared.config import get_cors_origins


def test_get_cors_origins_strips_paths() -> None:
    """get_cors_origins extracts scheme + netloc from full URLs."""
    with patch("app.shared.config.config") as mock_config:
        mock_config.allowed_redirect_urls = [
            "http://localhost:5173/inkwell",
            "https://linnienaryshkin.github.io",
            "http://localhost:3000",
        ]
        origins = get_cors_origins()

        assert "http://localhost:5173" in origins
        assert "https://linnienaryshkin.github.io" in origins
        assert "http://localhost:3000" in origins
        assert len(origins) == 3


def test_get_cors_origins_deduplicates() -> None:
    """get_cors_origins removes duplicate origins."""
    with patch("app.shared.config.config") as mock_config:
        mock_config.allowed_redirect_urls = [
            "http://localhost:5173/app",
            "http://localhost:5173/other",
            "https://example.com",
        ]
        origins = get_cors_origins()

        # Should deduplicate localhost:5173
        assert origins.count("http://localhost:5173") == 1
        assert "https://example.com" in origins


def test_config_missing_env_raises_runtime_error() -> None:
    """Config._load raises RuntimeError when required env var is missing."""
    with patch.dict(os.environ, {}, clear=True):
        # Clear required env vars
        with pytest.raises(RuntimeError) as exc_info:
            from importlib import reload

            import app.config

            reload(app.config)

        assert "Missing required environment variable" in str(exc_info.value)
