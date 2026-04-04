"""
Shared pytest configuration.

Loads environment variables from .env.example at the repo root so that
auth.py's module-level _load_config() finds them before any test module
is collected. Real secrets in .env (if present) take precedence via
os.environ.setdefault — existing vars are never overwritten.
"""

import os
from pathlib import Path

_env_example = Path(__file__).resolve().parents[2] / ".env.example"

if _env_example.exists():
    for line in _env_example.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())
