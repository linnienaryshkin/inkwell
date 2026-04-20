"""Shared middleware and error handlers for REST and MCP servers."""

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


def setup_error_handlers(app: FastAPI) -> None:
    """Register shared error handlers on FastAPI/FastMCP app.

    Sets up exception handlers for common error cases to ensure consistent
    error responses across REST and MCP servers.

    Args:
        app: FastAPI or FastMCP application instance.
    """

    @app.exception_handler(httpx.HTTPStatusError)
    async def github_http_error_handler(
        request: Request, exc: httpx.HTTPStatusError
    ) -> JSONResponse:
        """Convert unhandled GitHub API HTTP errors into 502 responses.

        Args:
            request: The incoming HTTP request.
            exc: The httpx.HTTPStatusError exception from GitHub API.

        Returns:
            JSONResponse: 502 error with GitHub API error details.
        """
        return JSONResponse(
            status_code=502,
            content={"detail": f"GitHub API error: {exc.response.status_code}"},
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        """Convert unhandled ValueError (e.g. malformed article data) into 502 responses.

        Args:
            request: The incoming HTTP request.
            exc: The ValueError exception.

        Returns:
            JSONResponse: 502 error with exception message.
        """
        return JSONResponse(
            status_code=502,
            content={"detail": str(exc)},
        )


async def get_authenticated_user_login(gh_access_token: str | None) -> str:
    """Fetch the authenticated user's login from GitHub API.

    Reusable across routes to extract user identity from a GitHub access token.
    This is the single source of truth for user authentication.

    Args:
        gh_access_token: GitHub access token from httponly cookie.

    Returns:
        str: GitHub user login.

    Raises:
        HTTPException: 401 if the token is invalid or 502 if GitHub API fails.
    """
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient() as http:
        try:
            resp = await http.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {gh_access_token}"},
            )
            resp.raise_for_status()
            return resp.json()["login"]
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=401, detail="Invalid access token")
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="GitHub API error")
