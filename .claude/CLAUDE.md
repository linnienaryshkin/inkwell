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
task dev           # Start both dev servers concurrently
task test          # Run all tests (ui + api)
task quality-gate  # Run all quality checks in sequence (ui then api)
```

Package-specific commands are in `.claude/rules/ui.md` and `.claude/rules/api.md`.

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

FastAPI REST API backed by GitHub repo file storage via `app/github_articles.py` (GitHub Contents API for reads, Git Data API for writes). All article routes require authentication. Configuration is centralized in `app/config.py`.

**Endpoints:**

| Method | Path | Description |
| ------ | ---- | ----------- |
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

**Module structure:** `app/main.py` (entry), `app/routers/articles.py`, `app/routers/auth.py`, `app/models/article.py`, `app/models/auth.py`, `app/github_articles.py` (GitHub-backed storage layer), `app/config.py` (env config), `app/ai/` (reserved for LangChain).

**CORS:** Allows `http://localhost:5173` and `https://linnienaryshkin.github.io` with `allow_credentials=True`.

### MCP Server (`api/app/mcp/`)

FastMCP server that mirrors REST API endpoints, enabling Claude Code and other MCP clients to access article management via the Model Context Protocol.

**Transport:** stdio (message-based, no HTTP ports)

**Tools (5 total):**

| Tool | Parameters | Returns | Errors |
|------|-----------|---------|--------|
| `list_articles` | `access_token: str` | `ArticleMeta[]` | 401, 502 |
| `get_article` | `access_token: str`, `slug: str` | `Article` | 401, 404, 502 |
| `create_article` | `access_token: str`, `title`, `slug`, `tags`, `content` | `Article` | 401, 409, 502 |
| `save_article` | `access_token: str`, `slug`, `title`, `tags`, `content`, `message?` | `Article` | 401, 404, 502 |
| `delete_article` | `access_token: str`, `slug` | `null` | 401, 404, 502 |

**Authentication:** Pass GitHub access token as `access_token` parameter on each tool call (per-call auth, not stored server-side).

**Module structure:**
- `app/mcp/tools.py` — Tool definitions with input schemas
- `app/mcp/handlers.py` — Tool implementations; call `github_articles.py` functions
- `app/main_mcp.py` — FastMCP entrypoint; registers all tools

**Shared infrastructure:**
- Reuses `github_articles.py` (GitHub API layer)
- Reuses `app/models/` (Pydantic schemas)
- Reuses error handling from `app/shared/middleware.py`

**Development:** Start with `task api:mcp-dev` or `task dev` (which spawns all servers).

## Testing

Full testing rules are in `.claude/rules/unit-test.md`. Both packages follow the same conventions:

- **UI:** test files colocated with the source file as `FileName.test.{ts,tsx}`; query priority: `getByRole` > `getByLabelText` > `getByText` > `data-testid`; mock only external libraries (Monaco, ReactMarkdown)
- **API:** test files in `api/tests/`; cover success cases, error cases, and edge cases for every endpoint; mock only external I/O (GitHub API calls)

## Git Workflow

**All git operations (commit, push, branch, merge, PR) are restricted to the `git-agent`.** Direct `git commit`, `git push`, `gh pr create`, etc. are denied by project permissions. Always delegate to the git-agent after code changes are complete.

Commit format: `#ISSUE: description` (e.g. `#42: add user authentication`). Use `#0` when no issue applies.

## Skills & Agents

- **architect skill** — fetches a GitHub issue, asks clarifying questions, writes a technical spec with a Team Execution Plan, posts it as a GitHub comment, and labels the issue `refined`
- **dev-supervisor skill** — coordinates sub-agents; decomposes tasks, assigns agents, runs parallel batches, tracks progress, and reports results. Never implements anything directly
- **dev-agent** — primary implementation agent; handles feature development from GitHub issues, bug fixes, code reviews, and architectural questions following all CLAUDE.md conventions
- **documentarian-agent** — documentation owner and synchronizer; knows where every doc file lives, cross-checks docs against actual code, and updates stale entries. Run via `/init` at session start or after code changes. Also answers "where is X?" questions about the codebase
- **qa-agent** — manual-only QA agent; verifies test coverage, runs browser tests via Playwright, writes failing tests for bugs found, and delegates fixes to the appropriate engineer
- **git-agent** — invoked after code changes to run quality gates, create commits with `#ISSUE: description` format, and open PRs. **Only agent with git permissions.**
- **ui rule** (see `.claude/rules/ui.md`) — applied automatically for UI changes; enforces state ownership, styling rules, and development conventions
- **api rule** (see `.claude/rules/api.md`) — applied automatically for API changes; enforces API conventions, schema sync, testing, and docstring requirements
- **unit-test rule** (see `.claude/rules/unit-test.md`) — applied automatically for test changes; enforces BDD approach and 90% coverage
- **github rule** (see `.claude/rules/github.md`) — applied automatically for CI/CD changes; is the single source of truth for workflow files, branch protection, deployment environment, Pages config, secrets, and re-running jobs
- **code-review skill** — `/code-review <PR URL or number>`; runs four focused review passes (correctness, security, conventions, tests) and posts inline GitHub comments
