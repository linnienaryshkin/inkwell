# GitHub Repository Current State Mirror

**Last Updated:** 2026-04-06
**Repository:** [linnienaryshkin/inkwell](https://github.com/linnienaryshkin/inkwell)
**Main Branch:** `main`

---

## Overview

This file mirrors the **current state** of GitHub configuration by reflecting what is actually defined in:

- **Workflow definitions:** [`.github/workflows/*.yml`](../../.github/workflows) (source of truth for CI/CD)
- **Task definitions:** [`ui/Taskfile.yml`](../../ui/Taskfile.yml), [`api/Taskfile.yml`](../../api/Taskfile.yml) (source of truth for local quality gates)
- **GitHub branch/environment settings:** Verified via `gh api` (source of truth for protection rules)
- **GitHub Actions secrets:** Listed via `gh secret list` (source of truth for credentials)

**Keep this file synchronized** with those files. When any workflow, task, or GitHub setting changes, update the corresponding section here immediately.

---

## 1. Branch Protection (`main`)

**Verify:**

- 🔗 [GitHub Settings UI](https://github.com/linnienaryshkin/inkwell/settings/branches)
- 🔗 [Via CLI](https://github.com/linnienaryshkin/inkwell): `gh api repos/linnienaryshkin/inkwell/branches/main/protection`

### Current State ✓ VERIFIED

| Setting | Value |
|---------|-------|
| Required status checks | `ui-quality-gate`, `api-quality-gate` |
| Strict mode (require up to date) | ✓ Enabled |
| Enforce admins | ✓ Enabled (only admins bypass) |
| Allow force pushes | ✗ Disabled |
| Allow deletions | ✗ Disabled |

### Relationship to Other Files

- Section 2 lists the workflow jobs that become required status checks
- [`.claude/rules/github.md`](../../.claude/rules/github.md) explains how to modify these settings

---

## 2. CI/CD Workflows

**Verify:**

- 🔗 [UI Workflow](../../.github/workflows/ui-ci.yml) — `.github/workflows/ui-ci.yml`
- 🔗 [API Workflow](../../.github/workflows/api-ci.yml) — `.github/workflows/api-ci.yml`
- 🔗 [Claude Workflow](../../.github/workflows/claude.yml) — `.github/workflows/claude.yml`

### UI Workflow (`ui-ci.yml`)

**Trigger:** `push` / `pull_request` → `main` on `ui/**` or `.github/workflows/ui-ci.yml` changes

**Jobs:**

```
ui-quality-gate (required status check)
  Steps (mirror ui/Taskfile.yml quality-gate task):
  ├── task install         (npm ci + husky)
  ├── task lint-check      (ESLint read-only)
  ├── task format-check    (Prettier read-only)
  ├── task types-check     (tsc --noEmit)
  ├── task test-coverage   (Jest 90% coverage)
  ├── task security        (npm audit --audit-level=high)
  └── task build           (Vite build → dist/)
       └── Upload ui/dist artifact (if github.ref == 'refs/heads/main')
            └── ui-deploy (needs: ui-quality-gate, if: github.ref == 'refs/heads/main')
                          (environment: github-pages)
```

**Source:** [`.github/workflows/ui-ci.yml`](../../.github/workflows/ui-ci.yml) lines 16–76

**Related Task Definition:** [`ui/Taskfile.yml`](../../ui/Taskfile.yml) lines 66–74

### API Workflow (`api-ci.yml`)

**Trigger:** `push` / `pull_request` → `main` on `api/**` or `.github/workflows/api-ci.yml` changes

**Jobs:**

```
api-quality-gate (required status check)
  Steps (mirror api/Taskfile.yml quality-gate task):
  ├── task install       (uv sync --extra dev)
  ├── task lint-check    (ruff check read-only)
  ├── task format-check  (ruff format --check)
  ├── task test          (pytest)
  └── task security      (pip-audit)
```

**Source:** [`.github/workflows/api-ci.yml`](../../.github/workflows/api-ci.yml) lines 16–48

**Related Task Definition:** [`api/Taskfile.yml`](../../api/Taskfile.yml) lines 45–51

### Claude Workflow (`claude.yml`)

**Trigger:** `issue_comment`, `pull_request_comment` with `@claude` mention

**Purpose:** Claude Code Action responder (automated AI agent)

**Source:** [`.github/workflows/claude.yml`](../../.github/workflows/claude.yml)

### Pre-commit Hook Sync Rule

**Verify:**

- 🔗 [Pre-commit Hook](../../.husky/pre-commit) — `.husky/pre-commit`

**Current State:**

```sh
task ui:quality-gate   # Runs the UI quality-gate task from ui/Taskfile.yml
task api:quality-gate  # Runs the API quality-gate task from api/Taskfile.yml
```

**Sync Rule (enforced by [`.claude/rules/github.md`](../../.claude/rules/github.md)):**

When workflow steps change, **update the corresponding `quality-gate` task first**, then the hook automatically picks it up:

1. Modify [`.github/workflows/ui-ci.yml`](../../.github/workflows/ui-ci.yml) or [`.github/workflows/api-ci.yml`](../../.github/workflows/api-ci.yml)
2. Update the corresponding `quality-gate` task in [`ui/Taskfile.yml`](../../ui/Taskfile.yml) or [`api/Taskfile.yml`](../../api/Taskfile.yml)
3. Verify [`.husky/pre-commit`](../../.husky/pre-commit) mirrors the task definitions
4. Update this section (section 2) to reflect the new steps

**Example:** If `ui-ci.yml` adds a new ESLint plugin step:

- Add step to [`.github/workflows/ui-ci.yml`](../../.github/workflows/ui-ci.yml)
- Ensure [`ui/Taskfile.yml`](../../ui/Taskfile.yml) quality-gate task includes it
- Update the task tree above in this file

---

## 3. Deployment Environment (`github-pages`)

**Verify:**

- 🔗 [GitHub Settings UI](https://github.com/linnienaryshkin/inkwell/settings/environments/github-pages)
- 🔗 [Via CLI](https://github.com/linnienaryshkin/inkwell): `gh api repos/linnienaryshkin/inkwell/environments/github-pages`

### Current State ✓ VERIFIED

| Setting | Value |
|---------|-------|
| Deployment branch policy | Custom branch policies (enabled) |
| Allowed branches | `main` only (1 policy) |
| Require admins approval | ✗ Disabled |

### Branch Policies

Only `main` branch can deploy to GitHub Pages. PR branches are blocked by name-based policy.

### Deployment Flow (from [`.github/workflows/ui-ci.yml`](../../.github/workflows/ui-ci.yml))

1. Push to `main` → `ui-ci.yml` triggers
2. `ui-quality-gate` runs (all checks must pass)
3. Vite build artifact uploaded
4. `ui-deploy` job waits for `ui-quality-gate` + checks `github.ref == 'refs/heads/main'`
5. Deployment to `github-pages` environment occurs
6. GitHub Pages publishes to <https://linnienaryshkin.github.io/inkwell/>

---

## 4. GitHub Pages

**Verify:**

- 🔗 [GitHub Settings UI](https://github.com/linnienaryshkin/inkwell/settings/pages)
- 🔗 [Via CLI](https://github.com/linnienaryshkin/inkwell): `gh api repos/linnienaryshkin/inkwell/pages`
- 🔗 [Live Site](https://linnienaryshkin.github.io/inkwell/)

### Current State ✓ VERIFIED

| Setting | Value |
|---------|-------|
| Source | GitHub Actions (workflow) |
| Build status | ✓ Published |
| Live URL | <https://linnienaryshkin.github.io/inkwell/> |
| Custom domain | None |

---

## 5. GitHub Actions Secrets

**Verify:**

- 🔗 [GitHub Settings UI](https://github.com/linnienaryshkin/inkwell/settings/secrets/actions)
- 🔗 [Via CLI](https://github.com/linnienaryshkin/inkwell): `gh secret list --repo linnienaryshkin/inkwell`

### Current Secrets ✓ VERIFIED

| Secret Name | Used By | Last Updated | Purpose |
|------------|---------|--------------|---------|
| `ALLOWED_REDIRECT_URLS` | [`api/`](../../api) (FastAPI) | 2026-04-06 | Comma-separated OAuth redirect URL allowlist and CORS origin source of truth |
| `ANTHROPIC_API_KEY` | [`.github/workflows/claude.yml`](../../.github/workflows/claude.yml) | 2026-03-30 | Claude API authentication for AI workflows |
| `OAUTH_CLIENT_ID` | [`api/`](../../api) (FastAPI) | 2026-04-04 | GitHub OAuth app client ID |
| `OAUTH_CLIENT_SECRET` | [`api/`](../../api) (FastAPI) | 2026-04-04 | GitHub OAuth app client secret |
| `OAUTH_CALLBACK_URL` | [`api/`](../../api) (FastAPI) | 2026-04-04 | GitHub OAuth callback URL |

### Environment Variable Source of Truth

| File | Purpose | Committed? |
|------|---------|-----------|
| [`api/.env.example`](../../api/.env.example) | Documents all API secrets/vars with placeholders | ✓ Yes |
| [`ui/.env.example`](../../ui/.env.example) | Documents all UI env vars with placeholders | ✓ Yes |
| `api/.env` (gitignored) | Local dev; developer fills in real values | ✗ No |
| `ui/.env` (gitignored) | Local dev; developer fills in real values | ✗ No |
| GitHub Actions Secrets | CI/CD with real values | Encrypted |

---

## 6. API Endpoints & Implementation Status

**Verify:**

- 🔗 [API Documentation](../../.claude/CLAUDE.md#api) — `.claude/CLAUDE.md` (API section)
- 🔗 [API Router](../../api/app/routers) — `api/app/routers/`

### Implemented Endpoints

| Method | Path | Auth | Status |
|--------|------|------|--------|
| `GET` | `/articles` | ✓ Yes | Implemented |
| `GET` | `/articles/{slug}` | ✓ Yes | Implemented |
| `POST` | `/articles` | ✓ Yes | Implemented |
| `PATCH` | `/articles/{slug}` | ✓ Yes | Implemented |
| `DELETE` | `/articles/{slug}` | ✓ Yes | Implemented |
| `GET` | `/auth/login` | ✗ No | Implemented |
| `GET` | `/auth/callback` | ✗ No | Implemented |
| `GET` | `/auth/me` | ✓ Yes | Implemented |
| `POST` | `/auth/logout` | ✓ Yes | Implemented |

---

## 7. Feature Status

**Verify:**

- 🔗 [Project Overview](../../.claude/CLAUDE.md) — `.claude/CLAUDE.md` (What is Inkwell section)
- 🔗 [UI Components](../../ui/src/components) — `ui/src/components/`
- 🔗 [API Modules](../../api/app) — `api/app/`

### Implemented Features

- ✓ Article CRUD (create, read, update, delete)
- ✓ GitHub-backed article storage
- ✓ GitHub OAuth authentication
- ✓ Session management (login/logout)
- ✓ Monaco editor integration
- ✓ Markdown preview
- ✓ Mermaid diagram rendering
- ✓ Version history (GitHub commit history)
- ✓ Dark/light theme toggle
- ✓ Zen mode (F11 / Ctrl+Shift+Z)
- ✓ Responsive three-panel layout
- ✓ GitHub Pages deployment

### Mock Features (Not Wired Up)

- ⊘ Lint results in SidePanel (hardcoded scores)
- ⊘ Publish platform integrations (dev.to, Hashnode, Medium, Substack, LinkedIn)

---

## 8. How to Keep This File Current

### When Workflows Change

1. **Modify a workflow file** ([`.github/workflows/ui-ci.yml`](../../.github/workflows/ui-ci.yml) or [`.github/workflows/api-ci.yml`](../../.github/workflows/api-ci.yml))
2. **Update the corresponding Taskfile** ([`ui/Taskfile.yml`](../../ui/Taskfile.yml) or [`api/Taskfile.yml`](../../api/Taskfile.yml))
3. **Update this file's section 2** to reflect the new steps
4. **Verify [`.husky/pre-commit`](../../.husky/pre-commit) still mirrors the Taskfile** (it should automatically)

### When GitHub Settings Change

1. Use `gh api` to verify the actual GitHub state
2. Update the relevant section above (1, 3, 4, or 5)
3. Update "Last Updated" at the top

### When Features Are Implemented

1. Update section 7 to move from "Mock Features" to "Implemented Features"
2. If new API endpoints added, update section 6
3. Update "Last Updated" at the top

### Example: Adding a New Lint Step to UI CI

1. **Edit [`.github/workflows/ui-ci.yml`](../../.github/workflows/ui-ci.yml):**
   - Add new step to `ui-quality-gate` job

2. **Edit [`ui/Taskfile.yml`](../../ui/Taskfile.yml):**
   - Add corresponding task or modify `quality-gate` task definition

3. **Update this file (section 2, UI Workflow):**
   - Add the new step to the job tree

4. **Verify [`.husky/pre-commit`](../../.husky/pre-commit):**
   - Should already run the updated `task ui:quality-gate`
