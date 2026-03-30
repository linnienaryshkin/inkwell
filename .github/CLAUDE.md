# GitHub Configuration

This file documents the live GitHub settings for this repository — branch protection, deployment environments, Pages configuration, secrets, and workflows — along with the `gh` CLI commands and website URLs to manage them.

> **Keep this file current.** Whenever a setting is changed (via CLI or website), update the "Current state" for the relevant section below, **and keep `.github/settings.yml` in sync** — Probot applies that file on every push to `main`.

---

## 0. Settings as Code (`settings.yml`)

**File:** `.github/settings.yml`
**Applied by:** [Probot Settings app](https://probot.github.io/apps/settings/) on every push to `main`

The file declaratively manages:
- **Repository metadata** — description, homepage, topics
- **Merge strategy** — squash + rebase only (`allow_merge_commit: false`, `delete_branch_on_merge: true`)
- **Labels** — canonical set used across all issues/PRs (`bug`, `enhancement`, `refined`, `wip`, `settings`, `publishing`, `sharing`, `documentation`)
- **Branch protection for `main`** — mirrors the manual settings in §1 below

> **Rule:** Any time you update branch protection via `gh api` (§1), also update `settings.yml` to match, and vice versa. The two sources of truth must stay in sync.

---

## Workflows

Located in `workflows/`.

| File | Trigger | Purpose |
|------|---------|---------|
| `workflows/ci-cd.yml` | push / PR → `main` | Quality gate (lint, format, types, test, security, build) + GitHub Pages deploy |
| `workflows/claude.yml` | issue/PR comments containing `@claude` | Runs Claude Code Action to respond to `@claude` mentions |

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

**Website:** https://github.com/linnienaryshkin/inkwell/settings/branches

### Current state

| Setting | Value |
|---------|-------|
| Required status checks | `ui-build`, `ui-format`, `ui-lint`, `ui-security`, `ui-test`, `ui-types` |
| Require branch up to date | `true` (strict) |
| Enforce admins | `false` |
| Allow force pushes | `false` |
| Allow deletions | `false` |

### View

```bash
gh api repos/linnienaryshkin/inkwell/branches/main/protection
```

### Update required status checks

```bash
gh api repos/linnienaryshkin/inkwell/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
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
EOF
```

When adding a new CI job that should gate merges, add it to both the workflow file and the `checks` array above, then update the current state table.

### Remove branch protection entirely

```bash
gh api repos/linnienaryshkin/inkwell/branches/main/protection --method DELETE
```

---

## 2. Deployment Environment (`github-pages`)

**Website:** https://github.com/linnienaryshkin/inkwell/settings/environments/13524189492/edit

### Current state

| Setting | Value |
|---------|-------|
| Deployment branch policy | Custom branch policies |
| Allowed branches | `main` only |

### View

```bash
gh api repos/linnienaryshkin/inkwell/environments/github-pages
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies
```

### Restrict deployments to `main` only (production state)

```bash
# 1. Enable custom branch policies
gh api repos/linnienaryshkin/inkwell/environments/github-pages \
  --method PUT \
  --input - <<'EOF'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF

# 2. Add main policy (if not already present)
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies \
  --method POST --field name="main" --field type="branch"
```

### Temporarily allow all branches (to validate a fix)

```bash
gh api repos/linnienaryshkin/inkwell/environments/github-pages \
  --method PUT --field deployment_branch_policy=null
```

> **Important:** Name-based branch policies do NOT match PR merge refs (`refs/pull/*/merge`). When deploying from a PR context, use `null` (all branches) rather than a named policy. Always restore `main`-only restriction after validation, and update the current state table above.

### Allow a specific branch temporarily

```bash
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies \
  --method POST --field name="fix/my-branch" --field type="branch"
```

### Remove a specific branch policy

```bash
# Get the policy ID
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies

# Delete by ID
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies/<ID> \
  --method DELETE
```

---

## 3. GitHub Pages

**Website:** https://github.com/linnienaryshkin/inkwell/settings/pages

### Current state

| Setting | Value |
|---------|-------|
| Source | GitHub Actions (`workflow`) |
| Live URL | https://linnienaryshkin.github.io/inkwell/ |

### View

```bash
gh api repos/linnienaryshkin/inkwell/pages | jq '{build_type, status, html_url}'
```

### Enable (first-time setup)

```bash
gh api repos/linnienaryshkin/inkwell/pages --method POST --field build_type="workflow"
```

### Update source to GitHub Actions (if previously set to a branch)

```bash
gh api repos/linnienaryshkin/inkwell/pages --method PUT --field build_type="workflow"
```

---

## 4. Secrets

**Website:** https://github.com/linnienaryshkin/inkwell/settings/secrets/actions

### Current state

| Secret | Used by | Last updated |
|--------|---------|--------------|
| `ANTHROPIC_API_KEY` | `workflows/claude.yml` | 2026-03-24 |

### List secrets (names only — values are never shown)

```bash
gh secret list --repo linnienaryshkin/inkwell
```

### Add or update a secret

```bash
gh secret set ANTHROPIC_API_KEY --repo linnienaryshkin/inkwell
# Prompts for value securely (not echoed to terminal)
```

---

## 5. Re-running Failed Workflow Jobs

```bash
# List recent runs on a branch
gh run list --repo linnienaryshkin/inkwell --branch <branch> --limit 5

# View failure summary
gh run view <RUN_ID> --repo linnienaryshkin/inkwell

# View failure logs
gh run view <RUN_ID> --repo linnienaryshkin/inkwell --log-failed

# Re-run only failed jobs (fastest)
gh run rerun <RUN_ID> --repo linnienaryshkin/inkwell --failed

# Re-run all jobs
gh run rerun <RUN_ID> --repo linnienaryshkin/inkwell
```
