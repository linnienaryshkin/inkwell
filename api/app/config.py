"""
Central config module — loads and validates required environment variables once at import time.
Raises RuntimeError at startup if any required var is missing, so misconfiguration is caught early.

Import from here rather than reading os.environ directly in routers.
"""

import os
from dataclasses import dataclass

_REQUIRED_ENV = [
    "OAUTH_CLIENT_ID",
    "OAUTH_CLIENT_SECRET",
    "OAUTH_CALLBACK_URL",
    "ALLOWED_REDIRECT_URLS",
]


@dataclass(frozen=True)
class Config:
    oauth_client_id: str
    oauth_client_secret: str
    oauth_callback_url: str
    # Parsed from a comma-separated env var; used for both OAuth redirect validation and CORS
    allowed_redirect_urls: list[str]


def _load() -> Config:
    for v in _REQUIRED_ENV:
        if not os.environ.get(v):
            raise RuntimeError(f"Missing required environment variable: {v}")
    return Config(
        oauth_client_id=os.environ["OAUTH_CLIENT_ID"],
        oauth_client_secret=os.environ["OAUTH_CLIENT_SECRET"],
        oauth_callback_url=os.environ["OAUTH_CALLBACK_URL"],
        allowed_redirect_urls=[
            u.strip() for u in os.environ["ALLOWED_REDIRECT_URLS"].split(",") if u.strip()
        ],
    )


config = _load()
