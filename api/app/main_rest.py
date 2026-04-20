from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import articles, auth, chat, health
from app.shared.config import get_cors_origins
from app.shared.middleware import setup_error_handlers

app = FastAPI(title="Inkwell API", version="0.1.0")

# Register shared error handlers
setup_error_handlers(app)

# Add CORS middleware with origins derived from OAuth allowlist
cors_origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(articles.router, prefix="/articles", tags=["articles"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
