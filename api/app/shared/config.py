"""Configuration and setup utilities shared by the REST server."""

import urllib.parse

from app.config import config


def get_cors_origins() -> list[str]:
    """Return list of allowed CORS origins from config.

    Derives CORS origins from the same allowlist used for OAuth redirect validation
    to ensure a single source of truth. Strips paths from URLs (e.g.,
    "http://localhost:5173/inkwell/" → "http://localhost:5173").

    Returns:
        list[str]: List of allowed CORS origins with schemes and netlocs only.
    """
    return list(
        {
            urllib.parse.urlparse(url).scheme + "://" + urllib.parse.urlparse(url).netloc
            for url in config.allowed_redirect_urls
        }
    )
