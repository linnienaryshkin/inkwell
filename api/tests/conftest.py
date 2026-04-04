"""
Shared pytest configuration.

Sets the required environment variables that auth.py reads at module-load time
(via _load_config). This file is executed by pytest before any test module is
collected, so both test_auth.py and test_articles.py (which imports app.main
transitively) will find the variables already set.
"""
import os

os.environ.setdefault("GITHUB_CLIENT_ID", "test_client_id")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "test_client_secret")
os.environ.setdefault("GITHUB_CALLBACK_URL", "http://localhost:8000/auth/callback")
os.environ.setdefault("SESSION_SECRET", "test_session_secret")
