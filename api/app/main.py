from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import articles

app = FastAPI(title="Inkwell API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router)
