import urllib.parse

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import articles, auth

app = FastAPI(title="Inkwell API", version="0.1.0")


@app.exception_handler(httpx.HTTPStatusError)
async def github_http_error_handler(request: Request, exc: httpx.HTTPStatusError) -> JSONResponse:
    """Convert unhandled GitHub API HTTP errors into 502 responses."""
    return JSONResponse(
        status_code=502,
        content={"detail": f"GitHub API error: {exc.response.status_code}"},
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """Convert unhandled ValueError (e.g. malformed article data) into 502 responses."""
    return JSONResponse(
        status_code=502,
        content={"detail": str(exc)},
    )


# Derive CORS origins from the same allowlist used for OAuth redirect validation —
# single source of truth. Strip paths: "http://localhost:5173/inkwell/" → "http://localhost:5173"
_cors_origins = list(
    {
        urllib.parse.urlparse(url).scheme + "://" + urllib.parse.urlparse(url).netloc
        for url in auth.ALLOWED_REDIRECT_URLS
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router, prefix="/articles", tags=["articles"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
