---
description: GitHub CI/CD workflows, branch protection, deployment environments, Pages configuration, and secrets for this repository. Read this before editing any workflow file or GitHub settings.
paths:
  - ".github/**"
---

## When This Rule Applies

- Editing `.github/workflows/*.yml`
- Changing branch protection rules on `main`
- Modifying the `github-pages` deployment environment
- Changing GitHub Pages source or configuration
- Debugging a failed CI/CD run

## Implementation Checklist

- [ ] Read this file and the current workflow file — never edit from memory
- [ ] If adding a new job: add it to branch protection required checks (section 1 below)
- [ ] If the ui-deploy job is involved: verify environment branch policies are correct for the context (PR vs. direct push)
- [ ] After any workflow change: open a PR, watch the CI run, confirm all jobs pass
- [ ] If deploy job is temporarily unlocked: re-lock to `main` before or immediately after merge
- [ ] Update the "Current state" tables below if any settings were changed

# GitHub Configuration

> **Keep this file current.** Whenever a setting is changed (via API or website), update the "Current state" for the relevant section below.

---

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci-cd.yml` | push / PR → `main` | Quality gate (lint, format, types, test, security, build) + GitHub Pages deploy |
| `claude.yml` | issue/PR comments containing `@claude` | Runs Claude Code Action to respond to `@claude` mentions |

`ci-cd.yml` job dependency graph:

```
ui-quality-gate
  ├── npm ci
  ├── ESLint check
  ├── Prettier check
  ├── tsc --noEmit
  ├── Jest (90% coverage)
  ├── npm audit
  └── Vite build ──→ upload artifact (ui/dist)
                          │
                       ui-deploy  (needs ui-quality-gate; targets github-pages environment)

api-quality-gate (parallel, does NOT block ui-deploy)
  ├── ruff lint
  ├── ruff format --check
  ├── pytest
  └── pip-audit
```

## Common Pitfalls

- **Deploy fails with 404** — GitHub Pages not enabled; use GitHub MCP to set source to "GitHub Actions" in repo settings
- **Deploy blocked on PR branch** — branch policy doesn't match `refs/pull/*/merge`; use GitHub MCP to set `null` policy instead of a named branch
- **New CI job doesn't gate merges** — added to workflow but not to branch protection required checks
- **Re-run fails instantly** — environment branch policy still restricts the ref; check with GitHub MCP API

---

## 1. Branch Protection (`main`)

**Website:** <https://github.com/linnienaryshkin/inkwell/settings/branches>

### Current state

| Setting | Value |
|---------|-------|
| Required status checks | `ui-quality-gate`, `api-quality-gate` |
| Require branch up to date | `true` (strict) |
| Enforce admins | `false` |
| Allow force pushes | `false` |
| Allow deletions | `false` |

### View

Use GitHub MCP: `mcp__github__list_branches` or `GET /repos/linnienaryshkin/inkwell/branches/main/protection`

### Update required status checks

Use GitHub MCP: PUT `/repos/linnienaryshkin/inkwell/branches/main/protection` and body:
```json
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "ui-quality-gate" },
      { "context": "api-quality-gate" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
```

When adding a new CI job that should gate merges, add it to both the workflow file and the `checks` array above, then update the current state table.

### Remove branch protection entirely

Use GitHub MCP: DELETE `/repos/linnienaryshkin/inkwell/branches/main/protection`

---

## 2. Deployment Environment (`github-pages`)

**Website:** <https://github.com/linnienaryshkin/inkwell/settings/environments/13524189492/edit>

### Current state

| Setting | Value |
|---------|-------|
| Deployment branch policy | Custom branch policies |
| Allowed branches | `main` only |

### View

Use GitHub MCP:
- GET `/repos/linnienaryshkin/inkwell/environments/github-pages`
- GET `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies`

### Restrict deployments to `main` only (production state)

1. Enable custom branch policies with PUT `/repos/linnienaryshkin/inkwell/environments/github-pages`:
```json
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
```

2. Add main policy with POST `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies`:
```json
{ "name": "main", "type": "branch" }
```

### Temporarily allow all branches (to validate a fix)

PUT `/repos/linnienaryshkin/inkwell/environments/github-pages` with body:
```json
{ "deployment_branch_policy": null }
```

> **Important:** Name-based branch policies do NOT match PR merge refs (`refs/pull/*/merge`). When deploying from a PR context, use `null` (all branches) rather than a named policy. Always restore `main`-only restriction after validation, and update the current state table above.

### Allow a specific branch temporarily

POST `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies` with body:
```json
{ "name": "fix/my-branch", "type": "branch" }
```

### Remove a specific branch policy

1. Get the policy ID with GET `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies`
2. Delete with DELETE `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies/<ID>`

---

## 3. GitHub Pages

**Website:** <https://github.com/linnienaryshkin/inkwell/settings/pages>

### Current state

| Setting | Value |
|---------|-------|
| Source | GitHub Actions (`workflow`) |
| Live URL | <https://linnienaryshkin.github.io/inkwell/> |

### View

Use GitHub MCP: GET `/repos/linnienaryshkin/inkwell/pages` and extract `build_type`, `status`, and `html_url`

### Enable (first-time setup)

POST `/repos/linnienaryshkin/inkwell/pages` with body:
```json
{ "build_type": "workflow" }
```

### Update source to GitHub Actions (if previously set to a branch)

PUT `/repos/linnienaryshkin/inkwell/pages` with body:
```json
{ "build_type": "workflow" }
```

---

## 4. Secrets

**Website:** <https://github.com/linnienaryshkin/inkwell/settings/secrets/actions>

### Source of truth: `.env.example`

`.env.example` is the canonical list of every secret/env var this project needs. It lives at `api/.env.example` (API secrets) and `ui/.env.example` (Vite vars) and contains placeholder values so CI and tests can run without real credentials.

**Three-layer contract:**

| Layer | Who manages it | Purpose |
|-------|---------------|---------|
| `api/.env.example`, `ui/.env.example` | Committed to repo (devops skill keeps them up to date) | Documents every required var with a placeholder value; `api/.env.example` used by `api/tests/conftest.py` to seed test env |
| `api/.env`, `ui/.env` | **Manual — each developer** copies the example and fills in real values; never committed | Local dev with real credentials |
| GitHub Actions secrets (<https://github.com/linnienaryshkin/inkwell/settings/secrets/actions>) | **Manual — repo owner** adds real values via the UI; devops skill creates the secret slot if missing | CI/CD with real credentials |

**Rules:**
- Whenever a new secret is added to `api/.env.example` or `ui/.env.example`, the devops skill must also create the corresponding GitHub Actions secret slot (with a placeholder). The **user must then fill in the real value** in both the local `.env` and the GitHub Actions secret (via the website above).
- `api/.env` and `ui/.env` must never be committed — they are gitignored.
- `.env.example` files must never contain real secret values — only placeholders like `ci-placeholder` or empty strings.

### Current state

| Secret | Used by | Origin in `.env.example` | Last updated |
|--------|---------|--------------------------|--------------|
| `ANTHROPIC_API_KEY` | `claude.yml` | `ANTHROPIC_API_KEY=` | 2026-03-24 |
| `OAUTH_CLIENT_ID` | `api/` OAuth | `OAUTH_CLIENT_ID=ci-placeholder` | 2026-04-04 |
| `OAUTH_CLIENT_SECRET` | `api/` OAuth | `OAUTH_CLIENT_SECRET=ci-placeholder` | 2026-04-04 |
| `OAUTH_CALLBACK_URL` | `api/` OAuth | `OAUTH_CALLBACK_URL=http://localhost:8000/auth/callback` | 2026-04-04 |
| `SESSION_SECRET` | `api/` OAuth | `SESSION_SECRET=ci-placeholder-secret` | 2026-04-04 |

### List secrets (names only — values are never shown)

Use GitHub MCP: GET `/repos/linnienaryshkin/inkwell/actions/secrets`

### Add or update a secret

Use GitHub MCP: PUT `/repos/linnienaryshkin/inkwell/actions/secrets/<SECRET_NAME>` with encrypted secret value (base64-encoded)

---

## 5. Re-running Failed Workflow Jobs

Use GitHub MCP for workflow operations:

- **List recent runs on a branch**: GET `/repos/linnienaryshkin/inkwell/actions/runs?branch=<branch>&per_page=5`
- **View failure summary**: GET `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>`
- **View failure logs**: GET `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>/attempts/<ATTEMPT_NUMBER>/logs`
- **Re-run failed jobs**: POST `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>/rerun-failed-jobs`
- **Re-run all jobs**: POST `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>/rerun`
