# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Inkwell

A browser-based markdown writing studio for developer-writers. Monaco editor at the center, with article CRUD via a FastAPI backend backed by GitHub repo file storage. Articles are stored as files in `linnienaryshkin/inkwell` at `articles/{slug}/meta.json` and `articles/{slug}/content.md`. Deployed at <https://linnienaryshkin.github.io/inkwell/>.

**Currently wired up:** Article CRUD (fetch, create, save, delete), GitHub OAuth, version history from commits, Zen mode, dark/light theme, table of contents extraction from markdown.

**Currently mock (not wired up):** Lint results in SidePanel (shows hardcoded readability score), publish platform API calls (UI has platform buttons but no real POST calls to dev.to/Hashnode/Medium/Substack/LinkedIn).

## Repository Structure

Monorepo with two packages:

- `ui/` — Vite + React frontend (TypeScript)
- `api/` — FastAPI backend (Python, uv-managed)

## Commands

```bash
task install       # Install all deps (ui + api)
task dev           # Start all dev servers: REST API, MCP server, UI (concurrently)
task test          # Run all tests (ui + api)
task quality-gate  # Run all quality checks in sequence (ui then api)
task git-lint      # Validate current branch name
```

Individual servers (if you only need one):

```bash
task api:rest-dev  # FastAPI REST server only (localhost:8000)
task api:mcp-dev   # FastMCP server only (stdio protocol)
task ui:dev        # Vite frontend only (localhost:5173)
```

Package-specific commands (lint, format, types, test, build) are in `.claude/rules/ui.md` and `.claude/rules/api.md`. Git validation commands are documented under [Git Workflow](#git-workflow).

## Architecture

### UI (`ui/`)

Vite + React SPA. `src/main.tsx` is the entry point — it renders `StudioPage` directly. All UI state lives in `src/app/studio/page.tsx`.

**Three-panel layout:**

- **Left** – `ArticleList`: selects the active article; also renders a "+ New Article" button via `onNewArticle` callback
- **Center** – `EditorPane`: Monaco editor + ReactMarkdown preview (toggled), Mermaid diagram rendering via `MermaidBlock`, status bar. `EditorPane` receives `key={selectedSlug}` — this intentionally forces a full remount when the article changes, resetting Monaco's internal state. `VersionStrip` renders below it — shows real GitHub commit history; each version entry links to the GitHub commit URL
- **Right** – `SidePanel`: lint / publish / TOC tabs. Lint results are mock (hardcoded readability score + two example issues). Publish tab lists five hardcoded platforms (dev.to, Hashnode, Medium, Substack, LinkedIn) — no real API calls yet. TOC tab is rendered via `TocTab` component powered by `useHeadingExtraction`

**API integration:** `StudioPage` calls `fetchArticles()` and `fetchCurrentUser()` on mount via `src/services/api.ts`. Articles are loaded lazily — the list fetches `ArticleMeta[]` (summaries), then the full `Article` is fetched when one is selected. Users explicitly click Save; `saveArticle()` (full save via PATCH) or `createArticle()` (POST) is called accordingly. On articles failure/timeout (3s), falls back to `MOCK_METAS` / `MOCK_ARTICLE`. Auth state (`AuthUser | null`) lives in `StudioPage` — the header renders either a "Sign in with GitHub" link (unauthenticated) or a profile dropdown (authenticated) showing the user's avatar and login, with a "Sign out" button that calls `logout()` → `POST /auth/logout` and clears `currentUser`.

**State ownership rules** (enforced by `.claude/rules/ui.md`):

- Global state (`selectedSlug`, `summaries` (`ArticleMeta[]`), `selectedArticle` (`Article | null`), `draftTitle`, `draftTags`, `zenMode`, `theme`, `sidePanelTab`, `currentUser`, `profileMenuOpen`, `saving`, `saveError`, `deleting`, `articleLoading`, `appLoading`) lives in `StudioPage` and flows down as props
- Component-local state (e.g., `previewMode` in `EditorPane`, `lintResults` in `SidePanel`) stays in the component that owns it
- The `Article` / `ArticleMeta` / `ArticleVersion` types are defined in `studio/page.tsx` — import them from there, don't redefine. The shape is: `Article { slug, content, meta: ArticleMeta, versions: ArticleVersion[] }`

**Keyboard shortcuts:** `F11` or `Ctrl+Shift+Z` toggle zen mode (collapses header, article list, and side panel).

**Theming:** `data-theme` attribute on `<html>` switches between dark (default) and light CSS variable sets defined in `src/app/globals.css`. Always use CSS variables for colors (`var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-tertiary)`, `var(--border)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--accent)`, `var(--accent-hover)`, `var(--green)`, `var(--yellow)`, `var(--red)`). Use Tailwind for layout/spacing only.

**Path alias:** `@/` resolves to `src/`. Use it for all internal imports.

**Source layout:** `src/components/` holds all React components (colocated with their test files). `src/hooks/` and `src/services/` sit directly under `src/`, not under `components/`.

**Custom hook:** `src/hooks/useHeadingExtraction.ts` — parses markdown into a nested heading tree; used by `TocTab`.

### API (`api/`)

Two entry points backed by the same GitHub layer (`app/github_articles.py`):

1. **REST API** (`app/main_rest.py`) — HTTP server for the web UI (localhost:8000)
2. **MCP Server** (`app/main_mcp.py`) — stdio protocol server for Claude Code integration

Both reuse: `app/github_articles.py` (GitHub API layer), `app/models/` (Pydantic schemas), `app/config.py` (OAuth secrets), `app/shared/` (middleware, config utilities).

**REST API Endpoints:**

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/` | Health check |
| `GET`  | `/articles` | List all articles (401 if not authenticated, 502 on GitHub error) |
| `GET`  | `/articles/{slug}` | Get article by slug (401, 404) |
| `POST` | `/articles` | Create article (401, 409 on slug conflict) |
| `PATCH` | `/articles/{slug}` | Full save — title, tags, content, optional commit message (401, 404) |
| `DELETE` | `/articles/{slug}` | Delete article (401, 404) |
| `GET`  | `/auth/login` | Redirect to GitHub OAuth authorize |
| `GET`  | `/auth/callback` | GitHub OAuth callback — issues signed session cookie |
| `GET`  | `/auth/me` | Returns current user profile (401 if not authenticated) |
| `POST` | `/auth/logout` | Clears session cookie (403 if Origin not in allowlist) |

**Auth:** Plain httponly cookies — `gh_access_token` (session, 8 h max age) and `gh_oauth_state` (CSRF, 10 min). The access token is stored directly in the cookie, never server-side. CSRF protection uses a state token pipe-delimited with the redirect URL; redirect URLs validated against `ALLOWED_REDIRECT_URLS` allowlist. `POST /auth/logout` deletes both cookies and validates the request `Origin` header against the allowlist (403 if not allowed). Requires `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_CALLBACK_URL`, `ALLOWED_REDIRECT_URLS` env vars — server raises `RuntimeError` at startup if any are missing. See `api/.env.example` for placeholder values used in CI/tests.

**REST API Module structure:**

- `app/main_rest.py` — Flask/FastAPI entry point and server initialization
- `app/routers/articles.py`, `app/routers/auth.py` — Endpoint implementations
- `app/models/article.py` — Pydantic schemas (Article, ArticleMeta, ArticleVersion)
- `app/github_articles.py` — GitHub API layer (reads via Contents API, writes via Git Data API)
- `app/config.py` — OAuth configuration from environment
- `app/shared/config.py`, `app/shared/middleware.py` — Shared utilities for both REST and MCP
- `app/ai/` — Reserved for LangChain integration

**CORS:** Allows `http://localhost:5173` and `https://linnienaryshkin.github.io` with `allow_credentials=True`.

### MCP Server (`api/app/mcp/`)

FastMCP server enabling Claude Code and other MCP clients to access article management via the Model Context Protocol. Transport is stdio (message-based, no HTTP ports). Tools are called with per-call authentication (GitHub access token passed on each call).

**Tools (6 total):**

| Tool | Parameters | Returns | Description |
|------|-----------|---------|-------------|
| `health_check` | (none) | `{"status": "ok"}` | Verify server is running |
| `list_articles` | `access_token: str` | `ArticleMeta[]` | List all articles (401, 502) |
| `get_article` | `access_token: str`, `slug: str` | `Article` | Fetch article by slug (401, 404, 502) |
| `create_article` | `access_token: str`, `title`, `slug`, `tags`, `content` | `Article` | Create new article (401, 409, 502) |
| `save_article` | `access_token: str`, `slug`, `title`, `tags`, `content`, `message?` | `Article` | Update article (401, 404, 502) |
| `delete_article` | `access_token: str`, `slug` | `null` | Delete article (401, 404, 502) |

**Resources:** Documentation and schema definitions (browsable via MCP Inspector or Claude Code):

- `inkwell://article-schemas` — Available article field types
- `inkwell://article-constants` — Predefined values (categories, status codes)

**Module structure:**

- `app/main_mcp.py` — FastMCP entrypoint; registers all tools and resources
- `app/mcp/tools.py` — Tool definitions with input schemas and handlers
- `app/mcp/resources.py` — Resource definitions (schemas, constants)
- Reuses: `github_articles.py` (GitHub API), `app/models/` (Pydantic schemas), `app/shared/` (error handling)

**Development:** Start with `task api:mcp-dev` or `task dev` (starts REST API + MCP + UI concurrently).

## Testing

Full testing rules are in `.claude/rules/unit-test.md`. Both packages follow the same conventions:

- **UI:** test files colocated with the source file as `FileName.test.{ts,tsx}`; query priority: `getByRole` > `getByLabelText` > `getByText` > `data-testid`; mock only external libraries (Monaco, ReactMarkdown)
- **API:** test files in `api/tests/`; cover success cases, error cases, and edge cases for every endpoint; mock only external I/O (GitHub API calls)

## Git Workflow

**All git operations (commit, push, branch, merge, PR) are restricted to the `git-agent`.** Direct `git commit`, `git push`, `gh pr create`, etc. are denied by project permissions. Always delegate to the git-agent after code changes are complete.

**Commit format:** `#ISSUE: description` (e.g. `#42: add user authentication`). Use `#0` when no issue applies. Validated locally by `.husky/commit-msg` hook and in CI by `git-lint` job.

**Branch naming convention:** Use a prefix with issue number and lowercase kebab-case slug:

| Flow | Branch format | Example |
|------|---------------|---------|
| New feature | `feature/#ISSUE/slug` | `feature/#149/git-lint-rules` |
| Bugfix | `bugfix/#ISSUE/slug` | `bugfix/#137/editor-crash` |
| Hotfix | `hotfix/#ISSUE/slug` | `hotfix/#140/security-patch` |
| Article writing | `article/#ISSUE/slug` | `article/#151/rust-guide` |
| Infrastructure / docs | `chore/#ISSUE/slug` | `chore/#148/update-deps` |
| Main branch | `main` (bare) | `main` |

Branch names are validated locally by `task git-lint` and in CI by the `git-lint` job. Only `main` requires no prefix.

**Local validation:** Run `git commit` — the `commit-msg` hook validates the message. Or manually check: `task git-lint` (validates current branch), `task git-lint-commit MSG=<path>` (validates a message file).

## Skills & Agents

**Agents** (specialized workers for complex tasks):

- **dev-agent** — primary implementation agent; handles feature development from GitHub issues, bug fixes, code reviews, and architectural questions following all CLAUDE.md conventions
- **documentarian-agent** — documentation owner; audits and syncs all `.claude/` files and `CLAUDE.md`. Run via `/init` at session start or after code changes to verify docs match the codebase
- **qa-agent** — manual QA; verifies test coverage, runs browser tests via Playwright, writes failing tests for bugs, delegates fixes to dev-agent
- **git-agent** — git operations only; runs quality gates, commits with `#ISSUE: description` format, creates PRs. **Only agent with git permissions.**
- **plan-agent** (internal) — used by `/architect` and `/plan-mode-extend` skills to design implementation plans

**Skills** (user-invoked commands):

- **architect skill** (`/architect <issue-url>`) — fetches GitHub issue, asks clarifying questions, writes technical spec with Team Execution Plan, posts as comment, labels issue `refined`
- **dev-coordinator skill** (`/dev-coordinator <issue-url>`) — coordinates sub-agents; decomposes work, assigns agents, runs parallel batches, tracks progress, reports results
- **code-review skill** (`/code-review <PR-url-or-number>`) — runs four review passes (correctness, security, conventions, tests), posts inline GitHub comments
- **plan-mode-extend skill** (`/plan-mode-extend <issue-url>`) — combines Plan agent with GitHub posting; creates dev plan and publishes to issue

**Rules** (applied automatically based on files changed):

- **ui rule** (`.claude/rules/ui.md`) — UI changes; enforces state ownership, styling conventions, component patterns
- **api rule** (`.claude/rules/api.md`) — API changes; enforces endpoint patterns, schema sync, testing, docstring requirements
- **unit-test rule** (`.claude/rules/unit-test.md`) — test changes; enforces BDD approach, 90% coverage minimum
- **github rule** (`.claude/rules/github.md`) — CI/CD changes; single source of truth for workflows, branch protection, deployment, secrets, git lint. See Section 3.5 for git lint validation rules
