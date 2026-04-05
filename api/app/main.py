import urllib.parse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import articles, auth

app = FastAPI(title="Inkwell API", version="0.1.0")

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
