import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import articles, auth

app = FastAPI(title="Inkwell API", version="0.1.0")

# TODO: Rename FRONTEND_URL to UI_URL.
_frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# TODO: Leave comment what this is for?
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://linnienaryshkin.github.io",
        _frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: Why articles doesn't have prefix?
app.include_router(articles.router)
app.include_router(auth.router, prefix="/auth")
