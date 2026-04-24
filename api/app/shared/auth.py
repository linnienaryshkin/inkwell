from fastapi import Cookie, HTTPException


def require_auth(gh_access_token: str | None = Cookie(default=None)) -> str:
    """Dependency that enforces authentication via the gh_access_token cookie.

    Args:
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        str: The validated access token.

    Raises:
        HTTPException: 401 if no valid access token is found.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return gh_access_token
