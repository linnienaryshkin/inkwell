"""Shared middleware and error handlers for REST and MCP servers."""

import httpx
from fastapi import Request
from fastapi.responses import JSONResponse


def setup_error_handlers(app) -> None:
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
