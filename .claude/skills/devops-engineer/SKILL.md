---
name: devops-engineer
description: Use this skill when the task involves CI/CD pipelines, GitHub Actions workflows, branch protection rules, deployment environments, or GitHub Pages. Invoke even if the user doesn't say "CI" or "DevOps" — trigger on fixing a failing workflow run, adding a new job, changing what gates merges to `main`, or anything touching `.github/workflows/` or repo settings.
license: MIT
compatibility: GitHub MCP, internet access
---

# DevOps Skill

## Trigger Conditions

Invoke this skill when the task involves any of:

- Editing `.github/workflows/*.yml`
- Changing branch protection rules on `main`
- Modifying the `github-pages` deployment environment
- Changing GitHub Pages source or configuration
- Debugging a failed CI/CD run

## Reference

All current settings, GitHub MCP API calls, and API URLs are documented in **`.github/CLAUDE.md`**. Read that file before making any changes — it is the single source of truth for:

- Workflow job dependency graph
- Branch protection required checks
- Deployment environment policies
- GitHub Pages configuration
- Secrets
- Debugging failed runs

## Before Editing a Workflow

1. Read `.github/CLAUDE.md` and the current workflow file — never edit from memory
2. Check live branch protection and deployment environment state using the GitHub MCP API calls documented in `.github/CLAUDE.md`

## Implementation Checklist

- [ ] Read `.github/CLAUDE.md` for current state
- [ ] Read the current workflow file before editing
- [ ] If adding a new job: add it to branch protection required checks (see `.github/CLAUDE.md`)
- [ ] If the ui-deploy job is involved: verify environment branch policies are correct for the context (PR vs. direct push)
- [ ] After any workflow change: open a PR, watch the CI run, confirm all jobs pass
- [ ] If deploy job is temporarily unlocked: re-lock to `main` before or immediately after merge
- [ ] Update `.github/CLAUDE.md` "Current state" tables if any settings were changed

## Common Pitfalls

- **Deploy fails with 404** — GitHub Pages not enabled; use GitHub MCP to set source to "GitHub Actions" in repo settings
- **Deploy blocked on PR branch** — branch policy doesn't match `refs/pull/*/merge`; use GitHub MCP to set `null` policy instead of a named branch
- **New CI job doesn't gate merges** — added to workflow but not to branch protection required checks
- **Re-run fails instantly** — environment branch policy still restricts the ref; check with GitHub MCP API
