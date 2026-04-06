---
description: GitHub CI/CD workflows, branch protection, deployment environments, Pages configuration, and secrets. This is the single source of truth for all GitHub configuration. Read this before editing any workflow file, Taskfile, or GitHub settings.
paths:
  - ".github/**"
  - ".husky/**"
  - "Taskfile.yml"
  - "ui/Taskfile.yml"
  - "api/Taskfile.yml"
---

# GitHub Rule

This rule enforces synchronization between:
1. **Workflow definitions** (`.github/workflows/*.yml`) — CI/CD trigger logic
2. **Task definitions** (`ui/Taskfile.yml`, `api/Taskfile.yml`) — quality gate steps
3. **Pre-commit hooks** (`.husky/pre-commit`) — local validation
4. **GitHub settings** (branch protection, environments, secrets)

**Source of truth:** Always edit the relevant Taskfile first, then update the workflow to call the task.

---

## 1. CI/CD Workflow Architecture

### Overview

Two separate workflows enforce code quality before merge to `main`:

| Workflow | Trigger | Gate Job | Task | Enforced By |
|----------|---------|----------|------|------------|
| **ui-ci.yml** | `ui/**` changes | `ui-quality-gate` | `task ui:quality-gate` | Branch protection |
| **api-ci.yml** | `api/**` changes | `api-quality-gate` | `task api:quality-gate` | Branch protection |

Both workflows run on `push` and `pull_request` to `main`. The gate jobs become required status checks, meaning:
- **Pushes to main** must pass both gates (or only the changed one via path filtering)
- **PRs** must pass both gates before merge
- **Admins are NOT exempt** from status checks (enforced-for-admins = true)

### Workflow Path Filters

**ui-ci.yml** runs when:
```yaml
paths:
  - "ui/**"
  - ".github/workflows/ui-ci.yml"
```

**api-ci.yml** runs when:
```yaml
paths:
  - "api/**"
  - ".github/workflows/api-ci.yml"
```

This prevents unnecessary runs. If a PR only changes API files, ui-ci doesn't trigger, but it's still required by branch protection (so the PR can't merge without being required to pass it).

---

## 2. Task Definition Sync

### Source of Truth: Taskfiles

Each Taskfile contains a `quality-gate` task that mirrors the corresponding workflow steps.

#### ui/Taskfile.yml (`quality-gate` task)

```yaml
quality-gate:
  deps:
    - install
  cmds:
    - task: lint-check
    - task: format-check
    - task: types-check
    - task: test-coverage
    - task: security
    - task: build
```

Each subtask corresponds to a step in `.github/workflows/ui-ci.yml`:

| Task | Workflow Step | Command |
|------|---------------|---------|
| `install` | Install dependencies | `npm ci && npx husky install` |
| `lint-check` | Check ESLint | `npx eslint . --report-unused-disable-directives --max-warnings 0` |
| `format-check` | Check Prettier | `npx prettier . --check` |
| `types-check` | Check TypeScript | `tsc --noEmit` |
| `test-coverage` | Run tests | `jest --coverage --coverageThreshold='{"lines":90,"functions":90,"branches":90,"statements":90}'` |
| `security` | Audit dependencies | `npm audit --audit-level=high` |
| `build` | Build | `vite build` |

#### api/Taskfile.yml (`quality-gate` task)

```yaml
quality-gate:
  deps:
    - install
  cmds:
    - task: lint-check
    - task: format-check
    - task: test
    - task: security
```

Each subtask corresponds to a step in `.github/workflows/api-ci.yml`:

| Task | Workflow Step | Command |
|------|---------------|---------|
| `install` | Install dependencies | `uv sync --extra dev` |
| `lint-check` | Lint | `ruff check .` |
| `format-check` | Format check | `ruff format --check .` |
| `test` | Test | `pytest tests/` |
| `security` | Security audit | `pip-audit` |

---

## 3. Pre-commit Hook Sync

The `.husky/pre-commit` hook runs quality-gate tasks locally before commit:

```sh
task ui:quality-gate
task api:quality-gate
```

**Rule:** The hook runs both gates on every commit. This catches issues before they reach CI and prevents unnecessary CI runs.

**Why both tasks?** Because the cost of running both locally (~20s total) is much lower than pushing to CI and getting blocked. The workflow path filters then optimize CI runs.

---

## 4. Branch Protection (main)

### Current Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| **Required status checks** | `ui-quality-gate`, `api-quality-gate` | Both gates must pass before merge |
| **Strict mode** | ✓ Enabled | PR must be up to date with base before merge |
| **Enforce for admins** | ✗ Disabled | Admins can push directly to main, bypassing checks if needed |
| **Allow force pushes** | ✗ Disabled | Prevent rewriting history |
| **Allow deletions** | ✗ Disabled | Protect against accidental deletes |

### How to Modify

To add a new required status check:

1. Create a new workflow job (e.g., `security-scan`)
2. Make it a gate job (runs-on: ubuntu-latest, no dependencies except setup steps)
3. Add the job name to this rule's `Required status checks` list
4. Verify on GitHub: Settings → Branches → main → Edit → Require status checks

---

## 5. Deployment Environment (github-pages)

### Current Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| **Deployment branch policy** | Custom branch policies (enabled) | Only specific branches can deploy |
| **Allowed branches** | `main` (1 policy) | Only main deploys |
| **Require admin approval** | ✗ Disabled | Automatic deployment on push to main |

### Deployment Flow

1. **Push to main** → `ui-ci.yml` triggers
2. **`ui-quality-gate` passes** → Vite build artifact uploaded
3. **`ui-deploy` job waits** for `ui-quality-gate` + checks `github.ref == 'refs/heads/main'`
4. **Deployment to `github-pages` environment** occurs
5. **GitHub Pages publishes** to <https://linnienaryshkin.github.io/inkwell/>

---

## 6. GitHub Pages

| Setting | Value |
|---------|-------|
| **Source** | GitHub Actions (workflow) |
| **Build status** | ✓ Published |
| **Live URL** | <https://linnienaryshkin.github.io/inkwell/> |

---

## 7. GitHub Actions Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `ANTHROPIC_API_KEY` | `.github/workflows/claude.yml` | Claude API authentication |
| `OAUTH_CLIENT_ID` | `api/` (FastAPI) | GitHub OAuth app client ID |
| `OAUTH_CLIENT_SECRET` | `api/` (FastAPI) | GitHub OAuth app client secret |
| `OAUTH_CALLBACK_URL` | `api/` (FastAPI) | GitHub OAuth callback URL |

**How to add a new secret:**

```bash
gh secret set SECRET_NAME --body "value"
gh secret list  # Verify
```

---

## 8. How to Make Changes

### Adding a New Quality Check to UI

1. **Edit `ui/Taskfile.yml`:**
   ```yaml
   quality-gate:
     cmds:
       - task: lint-check
       - task: new-check  # Add here

   new-check:
     cmds:
       - new-command
   ```

2. **Edit `.github/workflows/ui-ci.yml`:**
   ```yaml
   - name: Run new check
     run: task new-check
   ```

3. **Update `.claude/CURRENT.md` section 2** with the new step

4. **The pre-commit hook automatically picks up the Taskfile change**

### Adding a New Required Status Check

1. **Create a new workflow file** (e.g., `.github/workflows/security.yml`)
2. **Define a gate job** (must complete before merge)
3. **Add to branch protection:**
   ```bash
   gh api repos/linnienaryshkin/inkwell/branches/main/protection \
     -f required_status_checks="{checks:[{context:'ui-quality-gate'},{context:'api-quality-gate'},{context:'new-gate'}]}"
   ```
4. **Update this rule** with the new check name

### Modifying Deployment Settings

1. **Edit `.github/workflows/ui-ci.yml`** (deployment conditions)
2. **Verify environment settings:**
   ```bash
   gh api repos/linnienaryshkin/inkwell/environments/github-pages
   ```
3. **Update branch policies:**
   ```bash
   gh api repos/linnienaryshkin/inkwell/environments/github-pages/deployment-branch-policies \
     -f deployment_branch_policy="{protected_branches:true,custom_branch_policies:true}" \
     -f custom_deployment_branch_policies='[{name:"main"}]'
   ```

### Changing GitHub Pages Settings

1. **Edit deployment source:**
   ```bash
   gh api repos/linnienaryshkin/inkwell/pages \
     -f source="{branch:\"gh-pages\",path:\"/\"}"
   ```

---

## 9. Verification Commands

Use these to verify GitHub state matches this rule:

```bash
# Branch protection
gh api repos/linnienaryshkin/inkwell/branches/main/protection

# Deployment environment
gh api repos/linnienaryshkin/inkwell/environments/github-pages

# GitHub Pages config
gh api repos/linnienaryshkin/inkwell/pages

# GitHub Actions secrets
gh secret list --repo linnienaryshkin/inkwell
```

---

## 10. Keep This Rule Current

### When to Update

- **Workflow file changes** → Update the corresponding Taskfile section
- **Taskfile changes** → Update the workflow if steps differ
- **GitHub settings changes** → Run the verification commands and update this rule
- **New features/APIs** → Update section 7 (API Endpoints)

### Verification Process

1. Make the change (workflow, Taskfile, or GitHub settings)
2. Run the corresponding verification command above
3. Update this rule with the new state
4. Update `.claude/CURRENT.md` with the change
5. Commit with message: `#0: sync github config`

---

## 11. Quick Reference: File Locations

| File | Purpose |
|------|---------|
| `.github/workflows/ui-ci.yml` | UI workflow definition |
| `.github/workflows/api-ci.yml` | API workflow definition |
| `.github/workflows/claude.yml` | Claude Code Action responder |
| `ui/Taskfile.yml` | UI task definitions (quality-gate source) |
| `api/Taskfile.yml` | API task definitions (quality-gate source) |
| `.husky/pre-commit` | Local pre-commit hook (runs both quality-gates) |
| `.claude/CURRENT.md` | Human-readable mirror of current GitHub state |
