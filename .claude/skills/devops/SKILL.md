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

## Workflow Overview

`ci-cd.yml` runs on push and PR to `main`. Job dependency graph:

```
install
  ├── lint
  ├── format
  ├── types
  ├── test       (90% coverage threshold)
  ├── security   (npm audit --audit-level=high)
  └── build ──→ upload artifact
                      │
                   deploy  (needs all 6 above; targets github-pages environment)
```

`claude.yml` triggers on `@claude` mentions in issues and PR comments.

## Before Editing a Workflow

1. Read the current file — never edit from memory
2. Check the current branch protection rules:
   ```bash
   gh api repos/linnienaryshkin/inkwell/branches/main/protection
   ```
3. Check the deployment environment:
   ```bash
   gh api repos/linnienaryshkin/inkwell/environments/github-pages
   gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies
   ```

## Branch Protection (`main`)

Required status checks (must all pass before merge): `build`, `format`, `lint`, `security`, `test`, `types`.

To update required checks:
```bash
gh api repos/linnienaryshkin/inkwell/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "build" },
      { "context": "format" },
      { "context": "lint" },
      { "context": "security" },
      { "context": "test" },
      { "context": "types" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
```

When adding a new CI job that should gate merges, add it to both the workflow file **and** the `checks` array above.

## Deployment Environment (`github-pages`)

The `deploy` job targets the `github-pages` environment. Default state: deployments restricted to `main` only.

### Restrict to `main` (production state)
```bash
# Enable custom branch policy
gh api repos/linnienaryshkin/inkwell/environments/github-pages \
  --method PUT \
  --input - <<'EOF'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF

# Add main policy
gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies \
  --method POST --field name="main" --field type="branch"
```

### Temporarily open to all branches (to validate a fix)
```bash
gh api repos/linnienaryshkin/inkwell/environments/github-pages \
  --method PUT --field deployment_branch_policy=null
```

> **Important:** Name-based branch policies do NOT match PR merge refs (`refs/pull/*/merge`). Use `null` (all branches) when deploying from a PR context.

Always restore `main`-only restriction after validation.

## GitHub Pages Source

Must be set to **GitHub Actions** (one-time setup via website or API):
```bash
gh api repos/linnienaryshkin/inkwell/pages --method PUT --field build_type="workflow"
```

Check current config and live URL:
```bash
gh api repos/linnienaryshkin/inkwell/pages | jq '{build_type, html_url, status}'
```

## Debugging Failed Runs

```bash
# List recent runs on a branch
gh run list --repo linnienaryshkin/inkwell --branch <branch> --limit 5

# View failure summary
gh run view <RUN_ID> --repo linnienaryshkin/inkwell

# View failure logs
gh run view <RUN_ID> --repo linnienaryshkin/inkwell --log-failed

# Re-run only failed jobs
gh run rerun <RUN_ID> --repo linnienaryshkin/inkwell --failed
```

## Implementation Checklist

- [ ] Read the current workflow file before editing
- [ ] If adding a new job: add it to branch protection required checks (see above)
- [ ] If the deploy job is involved: verify environment branch policies are correct for the context (PR vs. direct push)
- [ ] After any workflow change: open a PR, watch the CI run, confirm all jobs pass
- [ ] If deploy job is temporarily unlocked: re-lock to `main` before or immediately after merge
- [ ] Update `.github/README.md` "Current state" tables if any settings were changed

## Common Pitfalls

- **Deploy fails with 404** → GitHub Pages not enabled; set source to "GitHub Actions" in repo settings
- **Deploy blocked on PR branch** → branch policy doesn't match `refs/pull/*/merge`; use `null` policy instead of a named branch
- **New CI job doesn't gate merges** → added to workflow but not to branch protection required checks
- **Re-run fails instantly** → environment branch policy still restricts the ref; check with `gh api .../deployment-branch-policies`
