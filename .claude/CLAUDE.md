# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

Monorepo with two packages:

- `ui/` — Vite + React frontend (TypeScript)
- `api/` — FastAPI backend (Python, uv-managed)

## Commands

### UI (from `ui/`)

```bash
cd ui
npm run dev          # Vite dev server at localhost:5173/inkwell/ (production: https://linnienaryshkin.github.io/inkwell/)
npm run build        # Vite production build → dist/
npm run preview      # Serve the dist/ build locally to test before deploy
npm run lint         # ESLint auto-fix
npm run format       # Prettier auto-format
npm run test             # Jest (no coverage threshold)
npm run test:coverage  # Jest with 90% coverage threshold (enforced in CI)
npm run types:check  # TypeScript type-check without emitting (tsc --noEmit)
npm run security     # npm audit --audit-level=high

# Run a single test file
npx jest src/components/EditorPane.test.tsx --no-coverage
```

### API (from `api/`)

```bash
cd api
uv sync --extra dev              # Install deps (creates .venv automatically)
uv run uvicorn app.main:app --reload   # Dev server at localhost:8000
uv run pytest tests/ -v          # Run tests
uv run ruff check app/ tests/    # Lint
```

### Root Makefile shortcuts

Use these from the repo root to avoid `cd` commands:

```bash
make dev             # Start both servers concurrently
make dev-ui          # Start Vite dev server
make dev-api         # Start FastAPI dev server
make test-ui         # Run UI tests
make test-api        # Run API tests
make lint-ui         # ESLint + Prettier + tsc --noEmit
make lint-api        # Lint API code
```

## Architecture

### UI (`ui/`)

Vite + React SPA. `src/main.tsx` is the entry point — it renders `StudioPage` directly. All UI state lives in `src/app/studio/page.tsx`.

**Three-panel layout:**

- **Left** – `ArticleList`: selects the active article
- **Center** – `EditorPane`: Monaco editor + ReactMarkdown preview (toggled), Mermaid diagram rendering via `MermaidBlock`, status bar. `EditorPane` receives `key={selectedSlug}` — this intentionally forces a full remount when the article changes, resetting Monaco's internal state. `VersionStrip` renders below it (version timeline, mock data; "Restore" and "View diff" buttons are not yet wired up)
- **Right** – `SidePanel`: lint / publish / TOC tabs. Lint results are mock (hardcoded readability score + two example issues). Publish tab lists five hardcoded platforms (dev.to, Hashnode, Medium, Substack, LinkedIn) — no real API calls yet

**API integration:** `StudioPage` calls `fetchArticles()` on mount via `src/services/api.ts`. On failure/timeout (3s), falls back to `MOCK_ARTICLES`. A badge in the header shows `"live"` or `"demo mode"`.

**State ownership rules** (enforced by `ui-engineer` skill):

- Global state (`selectedSlug`, `articles[]`, `zenMode`, `theme`, `sidePanelTab`, `dataSource`) lives in `StudioPage` and flows down as props
- Component-local state (e.g., `previewMode` in `EditorPane`, `lintResults` in `SidePanel`) stays in the component that owns it
- The `Article` type is defined in `studio/page.tsx` — import it from there, don't redefine

**Keyboard shortcuts:** `F11` or `Ctrl+Shift+Z` toggle zen mode (collapses header, article list, and side panel).

**Theming:** `data-theme` attribute on `<html>` switches between dark (default) and light CSS variable sets defined in `src/app/globals.css`. Always use CSS variables for colors (`var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-tertiary)`, `var(--border)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--accent)`, `var(--accent-hover)`, `var(--green)`, `var(--yellow)`, `var(--red)`). Use Tailwind for layout/spacing only.

**Path alias:** `@/` resolves to `src/`. Use it for all internal imports.

**Custom hook:** `src/hooks/useHeadingExtraction.ts` — parses markdown into a nested heading tree for the TOC tab.

### API (`api/`)

FastAPI REST API with in-memory article store seeded from mock data. Mirrors the UI's `Article` type via Pydantic.

**Endpoints:**

| Method | Path              | Description                                |
| ------ | ----------------- | ------------------------------------------ |
| `GET`  | `/articles`       | List all articles                          |
| `GET`  | `/articles/{slug}` | Get article by slug                        |
| `POST` | `/articles`       | Create article (409 on slug conflict)      |
| `PATCH` | `/articles/{slug}` | Partial update (404 on unknown slug)       |

**Module structure:** `app/main.py` (entry), `app/routers/articles.py`, `app/models/article.py`, `app/ai/` (reserved for LangChain).

**CORS:** Allows `http://localhost:5173` in dev.

## Testing

Rules are in `.claude/rules/unit-test.md`. Both packages follow the same conventions:

- BDD approach: test behavior (user interactions / HTTP contract), not implementation internals
- 90% coverage on lines, functions, branches, and statements (enforced in CI)
- **UI:** test files colocated with the source file as `FileName.test.{ts,tsx}`; query priority: `getByRole` > `getByLabelText` > `getByText` > `data-testid`; mock only external libraries (Monaco, ReactMarkdown)
- **API:** test files in `api/tests/`; cover success cases, error cases, and edge cases for every endpoint; mock only external I/O

## Skills & Agents

- **architect-agent** — fetches a GitHub issue, asks clarifying questions, writes a technical spec, posts it as a GitHub comment, and labels the issue `refined`
- **dev-engineer** — primary implementation agent; handles feature development from GitHub issues, bug fixes, code reviews, and architectural questions following all CLAUDE.md conventions
- **qa-agent** — manual-only QA agent; verifies test coverage, runs browser tests via Playwright, writes failing tests for bugs found, and delegates fixes to the appropriate engineer
- **git-agent** — invoked after code changes to run quality gates, create commits with `#ISSUE: description` format, and open PRs
- **ui-engineer skill** — invoked automatically for UI changes; enforces state ownership and styling rules
- **api-engineer skill** — invoked automatically for API changes; enforces API conventions, schema sync, and testing
- **devops skill** — invoked automatically for CI/CD changes; manages workflow files, branch protection, deployment environment, and GitHub Pages config
- **review-pr skill** — `/review-pr <PR URL or number>`; runs four focused review passes (correctness, security, conventions, tests) and posts inline GitHub comments
