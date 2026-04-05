# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Inkwell

A browser-based markdown writing studio for developer-writers. Monaco editor at the center, with article CRUD via a FastAPI backend (in-memory, phase 1). Articles will eventually be stored as GitHub repo files. Deployed at <https://linnienaryshkin.github.io/inkwell/>.

**What's currently mock (not wired up):** lint results in SidePanel, publish platform calls, VersionStrip restore/diff buttons, SQLite/Postgres persistence.

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

- **Left** – `ArticleList`: selects the active article
- **Center** – `EditorPane`: Monaco editor + ReactMarkdown preview (toggled), Mermaid diagram rendering via `MermaidBlock`, status bar. `EditorPane` receives `key={selectedSlug}` — this intentionally forces a full remount when the article changes, resetting Monaco's internal state. `VersionStrip` renders below it (version timeline, mock data; "Restore" and "View diff" buttons are not yet wired up)
- **Right** – `SidePanel`: lint / publish / TOC tabs. Lint results are mock (hardcoded readability score + two example issues). Publish tab lists five hardcoded platforms (dev.to, Hashnode, Medium, Substack, LinkedIn) — no real API calls yet. TOC tab is rendered via `TocTab` component powered by `useHeadingExtraction`

**API integration:** `StudioPage` calls `fetchArticles()` and `fetchCurrentUser()` on mount via `src/services/api.ts`. `patchArticle(slug, patch)` is called on article edits. On articles failure/timeout (3s), falls back to `MOCK_ARTICLES`. A badge in the header shows `"live"` or `"demo mode"`. Auth state (`AuthUser | null`) lives in `StudioPage` — the header renders either a "Sign in with GitHub" link (unauthenticated) or a profile dropdown (authenticated) showing the user's avatar and login, with a "Sign out" button that calls `logout()` → `POST /auth/logout` and clears `currentUser`.

**State ownership rules** (enforced by `.claude/rules/ui.md`):

- Global state (`selectedSlug`, `articles[]`, `zenMode`, `theme`, `sidePanelTab`, `dataSource`, `currentUser`, `profileMenuOpen`) lives in `StudioPage` and flows down as props
- Component-local state (e.g., `previewMode` in `EditorPane`, `lintResults` in `SidePanel`) stays in the component that owns it
- The `Article` type is defined in `studio/page.tsx` — import it from there, don't redefine

**Keyboard shortcuts:** `F11` or `Ctrl+Shift+Z` toggle zen mode (collapses header, article list, and side panel).

**Theming:** `data-theme` attribute on `<html>` switches between dark (default) and light CSS variable sets defined in `src/app/globals.css`. Always use CSS variables for colors (`var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-tertiary)`, `var(--border)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--accent)`, `var(--accent-hover)`, `var(--green)`, `var(--yellow)`, `var(--red)`). Use Tailwind for layout/spacing only.

**Path alias:** `@/` resolves to `src/`. Use it for all internal imports.

**Source layout:** `src/components/` holds all React components (colocated with their test files). `src/hooks/` and `src/services/` sit directly under `src/`, not under `components/`.

**Custom hook:** `src/hooks/useHeadingExtraction.ts` — parses markdown into a nested heading tree; used by `TocTab`.

### API (`api/`)

FastAPI REST API with in-memory article store seeded from mock data. Mirrors the UI's `Article` type via Pydantic.

**Endpoints:**

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/articles` | List all articles |
| `GET`  | `/articles/{slug}` | Get article by slug |
| `POST` | `/articles` | Create article (409 on slug conflict) |
| `PATCH` | `/articles/{slug}` | Partial update (404 on unknown slug) |
| `GET`  | `/auth/login` | Redirect to GitHub OAuth authorize |
| `GET`  | `/auth/callback` | GitHub OAuth callback — issues signed session cookie |
| `GET`  | `/auth/me` | Returns current user profile (401 if not authenticated) |
| `POST` | `/auth/logout` | Clears session cookie (403 if Origin not in allowlist) |

**Auth:** Plain httponly cookies — `gh_access_token` (session, 8 h max age) and `gh_oauth_state` (CSRF, 10 min). The access token is stored directly in the cookie, never server-side. CSRF protection uses a state token pipe-delimited with the redirect URL; redirect URLs validated against `ALLOWED_REDIRECT_URLS` allowlist. `POST /auth/logout` deletes both cookies and validates the request `Origin` header against the allowlist (403 if not allowed). Requires `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_CALLBACK_URL`, `FRONTEND_URL` env vars — server raises `RuntimeError` at startup if any are missing. See `api/.env.example` for placeholder values used in CI/tests.

**Module structure:** `app/main.py` (entry), `app/routers/articles.py`, `app/routers/auth.py`, `app/models/article.py`, `app/models/auth.py`, `app/ai/` (reserved for LangChain).

**CORS:** Allows `http://localhost:5173` and `https://linnienaryshkin.github.io` with `allow_credentials=True`.

## Testing

Rules are in `.claude/rules/unit-test.md`. Both packages follow the same conventions:

- BDD approach: test behavior (user interactions / HTTP contract), not implementation internals
- 90% coverage on lines, functions, branches, and statements (enforced in CI)
- **UI:** test files colocated with the source file as `FileName.test.{ts,tsx}`; query priority: `getByRole` > `getByLabelText` > `getByText` > `data-testid`; mock only external libraries (Monaco, ReactMarkdown)
- **API:** test files in `api/tests/`; cover success cases, error cases, and edge cases for every endpoint; mock only external I/O

## Git Workflow

**All git operations (commit, push, branch, merge, PR) are restricted to the `git-agent`.** Direct `git commit`, `git push`, `gh pr create`, etc. are denied by project permissions. Always delegate to the git-agent after code changes are complete.

Commit format: `#ISSUE: description` (e.g. `#42: add user authentication`). Use `#0` when no issue applies.

## GitHub MCP & Environment Setup

Claude Code uses GitHub MCP server for AI-assisted GitHub workflows. **Setup required before launching Claude Code:**

```bash
source .dev-env
```

## Skills & Agents

- **architect skill** — fetches a GitHub issue, asks clarifying questions, writes a technical spec with a Team Execution Plan, posts it as a GitHub comment, and labels the issue `refined`
- **captain skill** — coordinates sub-agents; decomposes tasks, assigns agents, runs parallel batches, tracks progress, and reports results. Never implements anything directly
- **dev-agent** — primary implementation agent; handles feature development from GitHub issues, bug fixes, code reviews, and architectural questions following all CLAUDE.md conventions
- **documentarian-agent** — documentation owner and synchronizer; knows where every doc file lives, cross-checks docs against actual code, and updates stale entries. Run via `/init` at session start or after code changes. Also answers "where is X?" questions about the codebase
- **qa-agent** — manual-only QA agent; verifies test coverage, runs browser tests via Playwright, writes failing tests for bugs found, and delegates fixes to the appropriate engineer
- **git-agent** — invoked after code changes to run quality gates, create commits with `#ISSUE: description` format, and open PRs. **Only agent with git permissions.**
- **ui rule** (`.claude/rules/ui.md`) — applied automatically for UI changes; enforces state ownership and styling rules
- **api rule** (`.claude/rules/api.md`) — applied automatically for API changes; enforces API conventions, schema sync, and testing
- **github rule** — applied automatically for CI/CD changes; `.claude/rules/github.md` is the single source of truth for workflow files, branch protection, deployment environment, Pages config, secrets, and re-running jobs
- **code-review skill** — `/code-review <PR URL or number>`; runs four focused review passes (correctness, security, conventions, tests) and posts inline GitHub comments
