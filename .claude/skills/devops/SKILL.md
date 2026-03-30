---
name: devops
description: CI/CD changes, workflow files, branch protection, deployment environment, or GitHub Pages config
---

# DevOps Skill

## Trigger Conditions

Invoke this skill when the task involves any of:

- Editing `.github/workflows/*.yml`
- Changing branch protection rules on `main`
- Modifying the `github-pages` deployment environment
- Changing GitHub Pages source or configuration
- Debugging a failed CI/CD run
- Updating `.github/settings.yml`

## Settings as Code (`settings.yml`)

**File:** `.github/settings.yml`
**Applied by:** [Probot Settings app](https://probot.github.io/apps/settings/) on every push to `main`

Manages declaratively:
- **Repository metadata** — description, homepage, topics
- **Merge strategy** — `allow_merge_commit: false` (squash and rebase remain available)
- **Labels** — canonical set used across all issues/PRs
- **Branch protection for `main`** — required status checks, force-push / deletion rules

> Things Probot **cannot** manage: deployment environments, GitHub Pages source, secrets, and workflow files. Those require `gh api` commands (see sections below).

## Workflows

Located in `.github/workflows/`.

| File | Trigger | Purpose |
|------|---------|---------|
| `ci-cd.yml` | push / PR → `main` | Quality gate (lint, format, types, test, security, build) + GitHub Pages deploy |
| `claude.yml` | issue/PR comments containing `@claude` | Runs Claude Code Action |

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

## Before Editing a Workflow

1. Read the current workflow file — never edit from memory
2. Check live branch protection and deployment environment state using the `gh api` commands below

## Implementation Checklist

- [ ] Read the current workflow file before editing
- [ ] If adding a new job: add it to `settings.yml` branch protection `contexts` array AND apply via `gh api` (below)
- [ ] If the ui-deploy job is involved: verify environment branch policies are correct for the context (PR vs. direct push)
- [ ] After any workflow change: open a PR, watch the CI run, confirm all jobs pass
- [ ] If deploy job is temporarily unlocked: re-lock to `main` before or immediately after merge

## Common Pitfalls

- **Deploy fails with 404** — GitHub Pages not enabled; set source to "GitHub Actions" in repo settings
- **Deploy blocked on PR branch** — branch policy doesn't match `refs/pull/*/merge`; use `null` policy instead of a named branch
- **New CI job doesn't gate merges** — added to workflow but not to `settings.yml` required checks (and not applied via `gh api`)
- **Re-run fails instantly** — environment branch policy still restricts the ref; check with `gh api .../deployment-branch-policies`

---

## Reference: `gh` CLI Commands

### Branch Protection (`main`)

**Website:** https://github.com/linnienaryshkin/inkwell/settings/branches

**Current state:**

| Setting | Value |
|---------|-------|
| Required status checks | `ui-build`, `ui-format`, `ui-lint`, `ui-security`, `ui-test`, `ui-types` |
| Require branch up to date | `true` (strict) |
| Enforce admins | `false` |
| Allow force pushes | `false` |
| Allow deletions | `false` |

```bash
# View
gh api repos/linnienaryshkin/inkwell/branches/main/protection

# Update required status checks
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

# Remove protection entirely
gh api repos/linnienaryshkin/inkwell/branches/main/protection --method DELETE
```

When adding a new CI job that should gate merges, add it to both `settings.yml` and the `checks` array above, then update the table.

---

### Deployment Environment (`github-pages`)

**Website:** https://github.com/linnienaryshkin/inkwell/settings/environments/13524189492/edit

**Current state:**

| Setting | Value |
|---------|-------|
| Deployment branch policy | Custom branch policies |
| Allowed branches | `main` only |

```bash
# View
gh api repos/linnienaryshkin/inkwell/environments/github-pages
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies

# Restrict deployments to main only (production state)
gh api repos/linnienaryshkin/inkwell/environments/github-pages \
  --method PUT \
  --input - <<'EOF'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies \
  --method POST --field name="main" --field type="branch"

# Temporarily allow all branches (to validate a fix on a PR)
gh api repos/linnienaryshkin/inkwell/environments/github-pages \
  --method PUT --field deployment_branch_policy=null

# Allow a specific branch temporarily
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies \
  --method POST --field name="fix/my-branch" --field type="branch"

# Remove a specific branch policy
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies/<ID> \
  --method DELETE
```

> **Important:** Name-based branch policies do NOT match PR merge refs (`refs/pull/*/merge`). When deploying from a PR context, use `null` (all branches). Always restore `main`-only restriction after validation.

---

### GitHub Pages

**Website:** https://github.com/linnienaryshkin/inkwell/settings/pages

**Current state:**

| Setting | Value |
|---------|-------|
| Source | GitHub Actions (`workflow`) |
| Live URL | https://linnienaryshkin.github.io/inkwell/ |

```bash
# View
gh api repos/linnienaryshkin/inkwell/pages | jq '{build_type, status, html_url}'

# Enable (first-time setup)
gh api repos/linnienaryshkin/inkwell/pages --method POST --field build_type="workflow"

# Update source to GitHub Actions (if previously set to a branch)
gh api repos/linnienaryshkin/inkwell/pages --method PUT --field build_type="workflow"
```

---

### Secrets

**Website:** https://github.com/linnienaryshkin/inkwell/settings/secrets/actions

**Current state:**

| Secret | Used by | Last updated |
|--------|---------|--------------|
| `ANTHROPIC_API_KEY` | `workflows/claude.yml` | 2026-03-24 |

```bash
# List secrets (names only — values are never shown)
gh secret list --repo linnienaryshkin/inkwell

# Add or update a secret
gh secret set ANTHROPIC_API_KEY --repo linnienaryshkin/inkwell
```

---

### Re-running Failed Workflow Jobs

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
