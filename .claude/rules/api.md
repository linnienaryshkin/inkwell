---
description: API routes, Pydantic models, FastAPI app configuration, and tests for this repository.
paths:
  - "api/**"
---

## Trigger Conditions

Apply this rule when the task involves any of:

- Adding or modifying endpoints in `api/app/routers/`
- Changing Pydantic models in `api/app/models/`
- Editing `api/app/main.py` (middleware, CORS, router registration)
- Working in `api/app/ai/` (LangChain integration)
- Updating `api/pyproject.toml` (dependencies)
- Writing or fixing tests in `api/tests/`

## Project Structure

```
api/
├── app/
│   ├── main.py              # FastAPI app entry, CORS, router registration
│   ├── routers/
│   │   └── articles.py      # /articles CRUD endpoints, in-memory store
│   ├── models/
│   │   └── article.py       # Pydantic Article + ArticlePatch models
│   └── ai/                  # Reserved for LangChain integration
│       └── __init__.py
├── tests/
│   └── test_articles.py
├── pyproject.toml            # uv-managed deps
└── .python-version           # Python 3.12
```

## Development Commands

```bash
cd api
uv sync --extra dev                    # Install deps
uv run uvicorn app.main:app --reload   # Dev server at localhost:8000
uv run pytest tests/ -v                # Run tests
uv run ruff check app/ tests/          # Lint
uv run ruff format app/ tests/         # Auto-format
```

## API Design Conventions

- **Router prefix:** each router has a prefix (e.g., `/articles`) — register via `app.include_router()`
- **Models:** define request/response schemas as Pydantic `BaseModel` subclasses in `app/models/`
- **Partial updates:** use a separate `*Patch` model with all fields optional (`field: T | None = None`)
- **Error responses:** raise `HTTPException` with appropriate status codes (404, 409, 422)
- **CORS:** allowed origins are set in `app/main.py` — update when adding new frontend hosts
- **Storage:** phase 1 uses in-memory dicts; keep router contracts stable so swapping to a DB later is non-breaking

## Article Schema

Mirrors the TypeScript `Article` type in `ui/src/app/studio/page.tsx`:

```python
class Article(BaseModel):
    slug: str
    title: str
    status: Literal["draft", "published"]
    content: str
    tags: list[str]
```

Keep these two types in sync when either changes.

## Testing

- Use `httpx` + FastAPI `TestClient` for endpoint tests
- Reset in-memory store state between tests with an `autouse` fixture
- Test happy paths, 404s, 409 conflicts, and partial updates
- All tests must pass before committing: `uv run pytest tests/ -v`

## Linting

- Ruff with `E`, `F`, `I` rules enabled, `E501` ignored (long lines in string literals)
- Target: Python 3.12
- Run `uv run ruff check app/ tests/` — must pass with zero errors

## Implementation Checklist

- [ ] Identify which router/model is affected
- [ ] If adding a new endpoint: define Pydantic model, add route, return correct status code
- [ ] If changing the Article schema: update both `api/app/models/article.py` and `ui/src/app/studio/page.tsx`
- [ ] Write or update tests in `api/tests/`
- [ ] Run `uv run pytest tests/ -v` — all tests pass
- [ ] Run `uv run ruff check app/ tests/` — zero errors
- [ ] If adding a new router: register it in `app/main.py`
- [ ] If the UI consumes the new endpoint: update `ui/src/services/api.ts`

## Common Pitfalls

- Schema drift between Python and TypeScript `Article` types — keep them in sync
- Forgetting to reset in-memory store in tests — use the `autouse` fixture
- Adding a new router but not registering it in `main.py`
- Not handling 404 for unknown slugs in new endpoints
