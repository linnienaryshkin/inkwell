# Inkwell API

FastAPI backend for the Inkwell writing studio.

## Quick Start

```bash
uv sync --extra dev              # install deps + create .venv
uv run uvicorn app.main:app --reload   # http://localhost:8000
uv run pytest tests/ -v          # run tests
uv run ruff check app/ tests/    # lint
```

Once running, open http://localhost:8000/docs for the auto-generated Swagger UI (provided by FastAPI for free).

## How This App Is Organized

### Entry Point: `app/main.py`

This is where the FastAPI application is created and configured. Three things happen here:

1. **Create the app** -- `app = FastAPI(...)` creates the application instance
2. **Add middleware** -- CORS middleware allows the frontend (`localhost:5173`) to call the API from the browser. Without this, browsers block cross-origin requests.
3. **Register routers** -- `app.include_router(articles.router)` plugs in the article endpoints. Each router is a self-contained group of related endpoints.

When you run `uvicorn app.main:app`, uvicorn (the ASGI server) imports the `app` object from `app/main.py` and starts serving HTTP requests through it.

### Routers: `app/routers/`

Routers group related endpoints under a shared URL prefix. Think of them like Express routers or Spring controllers.

**`articles.py`** defines all `/articles` endpoints:

```
GET    /articles          --> list_articles()    --> returns all articles
GET    /articles/{slug}   --> get_article(slug)  --> returns one article or 404
POST   /articles          --> create_article()   --> creates an article or 409 if slug exists
PATCH  /articles/{slug}   --> patch_article()    --> partial update or 404
```

Key concepts:

- `APIRouter(prefix="/articles")` -- all routes in this file are automatically prefixed with `/articles`
- `@router.get("/{slug}")` -- the `{slug}` part is a **path parameter**. FastAPI extracts it from the URL and passes it as a function argument.
- `response_model=Article` -- tells FastAPI to serialize the return value using this Pydantic model and document it in the Swagger UI
- `HTTPException(status_code=404)` -- the standard way to return error responses in FastAPI

#### In-Memory Store

The `_store` dict holds articles keyed by slug. It's seeded with mock data on startup and lives only in memory -- restarting the server resets it. This is intentional for phase 1; it will be swapped for a database later without changing the router code.

### Models: `app/models/`

Pydantic models define the shape of request/response data. FastAPI uses them for:

1. **Validation** -- incoming JSON is automatically validated against the model. If a required field is missing or has the wrong type, FastAPI returns a 422 error with details. You don't write any validation code yourself.
2. **Serialization** -- the model controls what fields appear in the JSON response
3. **Documentation** -- the Swagger UI auto-generates schemas from these models

**`article.py`** defines two models:

- `Article` -- the full article (used for responses and POST requests). All fields are required.
- `ArticlePatch` -- for PATCH requests. All fields are `Optional` (`str | None = None`), so you can send just `{"status": "published"}` without providing every field.

The `model_copy(update={...})` method on a Pydantic model creates a new instance with some fields overridden -- this is how partial updates work without mutating the original.

### The `app/ai/` Directory

Reserved for future LangChain integration (linting articles with AI, etc.). Currently just an empty `__init__.py`. Install AI deps separately with `uv sync --extra ai`.

### Tests: `tests/`

Tests use FastAPI's `TestClient` (built on `httpx`), which lets you call endpoints without starting a real server:

```python
def test_get_article(client: TestClient):
    response = client.get("/articles/my-slug")
    assert response.status_code == 200
```

Key patterns:

- **`client` fixture** -- creates a `TestClient(app)` wrapping the FastAPI app. You call `client.get()`, `client.post()`, etc. just like a real HTTP client.
- **`reset_store` fixture (`autouse=True`)** -- automatically runs before/after every test. It snapshots the in-memory store, lets the test run, then restores it. This prevents tests from leaking state into each other.
- **`pytest.fixture`** -- pytest's dependency injection. When a test function has a parameter named `client`, pytest finds the `client` fixture and passes its return value.

## How the Pieces Connect

```
Browser (localhost:5173)
    |
    |  HTTP request: GET /articles
    v
uvicorn (ASGI server, localhost:8000)
    |
    |  routes request to FastAPI app
    v
app/main.py  -->  CORSMiddleware (adds Access-Control headers)
    |
    |  matches URL to router
    v
app/routers/articles.py  -->  list_articles()
    |
    |  reads from _store dict
    |  returns list[Article]
    v
FastAPI serializes Article models to JSON
    |
    v
Browser receives JSON response
```

## Dependency Management

Dependencies are declared in `pyproject.toml` and managed by **uv** (a fast Python package manager):

- **`dependencies`** -- runtime deps (FastAPI, uvicorn). Always installed.
- **`[project.optional-dependencies].dev`** -- dev-only deps (pytest, ruff, httpx). Install with `uv sync --extra dev`.
- **`[project.optional-dependencies].ai`** -- AI deps (LangChain). Install with `uv sync --extra ai`. Kept separate to avoid bloating the base install.

`uv sync` creates a `.venv/` directory automatically. You don't need to create or activate it manually -- `uv run <command>` always uses the correct venv.

## Linting

Ruff is the linter (it replaces flake8 + isort). Config lives in `pyproject.toml`:

- Rules: `E` (pycodestyle errors), `F` (pyflakes), `I` (import sorting)
- `E501` is ignored because markdown content in string literals exceeds line limits

Run: `uv run ruff check app/ tests/`

## Adding a New Endpoint

1. If it's a new resource (not articles), create a new router file in `app/routers/`
2. Define Pydantic models in `app/models/`
3. Add the route function with decorators (`@router.get`, `@router.post`, etc.)
4. Register the router in `app/main.py` with `app.include_router()`
5. Write tests in `tests/`
6. If the UI needs this endpoint, update `ui/src/services/api.ts`
