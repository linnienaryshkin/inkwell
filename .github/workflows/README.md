# GitHub Configuration

This file documents the live GitHub settings for this repository — branch protection, deployment environments, Pages configuration, secrets, and workflows — along with the GitHub MCP API calls and website URLs to manage them.

> **Keep this file current.** Whenever a setting is changed (via API or website), update the "Current state" for the relevant section below.

---

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci-cd.yml` | push / PR → `main` | Quality gate (lint, format, types, test, security, build) + GitHub Pages deploy |
| `claude.yml` | issue/PR comments containing `@claude` | Runs Claude Code Action to respond to `@claude` mentions |

`ci-cd.yml` job dependency graph:

```
ui-install
  ├── ui-lint
  ├── ui-format
  ├── ui-types
  ├── ui-test
  ├── ui-security
  └── ui-build ──→ upload artifact (ui/dist)
                        │
                     ui-deploy  (needs all 6 ui-* jobs; targets github-pages environment)

api-check (parallel, does NOT block ui-deploy)
  ├── ruff lint
  └── pytest
```

---

## 1. Branch Protection (`main`)

**Website:** <https://github.com/linnienaryshkin/inkwell/settings/branches>

### Current state

| Setting | Value |
|---------|-------|
| Required status checks | `api-check`, `ui-build`, `ui-format`, `ui-lint`, `ui-security`, `ui-test`, `ui-types` |
| Require branch up to date | `true` (strict) |
| Enforce admins | `false` |
| Allow force pushes | `false` |
| Allow deletions | `false` |

### View

Use GitHub MCP: `mcp__github__api_call` with GET `/repos/linnienaryshkin/inkwell/branches/main/protection`

### Update required status checks

Use GitHub MCP: `mcp__github__api_call` with PUT `/repos/linnienaryshkin/inkwell/branches/main/protection` and body:
```json
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "api-check" },
      { "context": "ui-build" },
      { "context": "ui-format" },
      { "context": "ui-lint" },
      { "context": "ui-security" },
      { "context": "ui-test" },
      { "context": "ui-types" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
```

When adding a new CI job that should gate merges, add it to both the workflow file and the `checks` array above, then update the current state table.

### Remove branch protection entirely

Use GitHub MCP: `mcp__github__api_call` with DELETE `/repos/linnienaryshkin/inkwell/branches/main/protection`

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
- `mcp__github__api_call` with GET `/repos/linnienaryshkin/inkwell/environments/github-pages`
- `mcp__github__api_call` with GET `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies`

### Restrict deployments to `main` only (production state)

Use GitHub MCP:

1. Enable custom branch policies with PUT `/repos/linnienaryshkin/inkwell/environments/github-pages`:
```json
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
```

2. Add main policy with POST `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies`:
```json
{ "name": "main", "type": "branch" }
```

### Temporarily allow all branches (to validate a fix)

Use GitHub MCP: PUT `/repos/linnienaryshkin/inkwell/environments/github-pages` with body:
```json
{ "deployment_branch_policy": null }
```

> **Important:** Name-based branch policies do NOT match PR merge refs (`refs/pull/*/merge`). When deploying from a PR context, use `null` (all branches) rather than a named policy. Always restore `main`-only restriction after validation, and update the current state table above.

### Allow a specific branch temporarily

Use GitHub MCP: POST `/repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies` with body:
```json
{ "name": "fix/my-branch", "type": "branch" }
```

### Remove a specific branch policy

Use GitHub MCP:

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

Use GitHub MCP: `mcp__github__api_call` with GET `/repos/linnienaryshkin/inkwell/pages` and extract `build_type`, `status`, and `html_url`

### Enable (first-time setup)

Use GitHub MCP: `mcp__github__api_call` with POST `/repos/linnienaryshkin/inkwell/pages` and body:
```json
{ "build_type": "workflow" }
```

### Update source to GitHub Actions (if previously set to a branch)

Use GitHub MCP: `mcp__github__api_call` with PUT `/repos/linnienaryshkin/inkwell/pages` and body:
```json
{ "build_type": "workflow" }
```

---

## 4. Secrets

**Website:** <https://github.com/linnienaryshkin/inkwell/settings/secrets/actions>

### Current state

| Secret | Used by | Last updated |
|--------|---------|--------------|
| `ANTHROPIC_API_KEY` | `claude.yml` | 2026-03-24 |

### List secrets (names only — values are never shown)

Use GitHub MCP: `mcp__github__api_call` with GET `/repos/linnienaryshkin/inkwell/actions/secrets`

### Add or update a secret

Use GitHub MCP: `mcp__github__api_call` with PUT `/repos/linnienaryshkin/inkwell/actions/secrets/ANTHROPIC_API_KEY` with encrypted secret value (base64-encoded)

---

## 5. Re-running Failed Workflow Jobs

Use GitHub MCP: `mcp__github__api_call` for workflow operations:

- **List recent runs on a branch**: GET `/repos/linnienaryshkin/inkwell/actions/runs?branch=<branch>&per_page=5`
- **View failure summary**: GET `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>`
- **View failure logs**: GET `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>/attempts/<ATTEMPT_NUMBER>/logs`
- **Re-run failed jobs**: POST `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>/rerun-failed-jobs`
- **Re-run all jobs**: POST `/repos/linnienaryshkin/inkwell/actions/runs/<RUN_ID>/rerun`
