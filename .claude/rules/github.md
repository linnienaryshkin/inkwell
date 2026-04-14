---
description: GitHub CI/CD workflows, branch protection, deployment environments, Pages configuration, and secrets. This is the single source of truth for all GitHub configuration. Read this before editing any workflow file, Taskfile, or GitHub settings.
paths:
  - ".github/**"
  - ".husky/**"
  - "scripts/git-lint.sh"
  - "Taskfile.yml"
  - "ui/Taskfile.yml"
  - "api/Taskfile.yml"
---

# GitHub Rule

This rule enforces synchronization between:

1. **Workflow definitions** (`.github/workflows/*.yml`) — CI/CD trigger logic
2. **Task definitions** (`ui/Taskfile.yml`, `api/Taskfile.yml`) — quality gate steps
3. **Pre-commit hooks** (`.husky/pre-commit`, `.husky/commit-msg`) — local validation
4. **Git lint validator** (`scripts/git-lint.sh`) — commit message and branch name validation
5. **GitHub settings** (branch protection, environments, secrets)

**Source of truth:** Always edit the relevant Taskfile first, then update the workflow to call the task.

---

## 1. CI/CD Workflow Architecture

### Overview

A single consolidated workflow (`.github/workflows/cicd.yml`) enforces code quality before merge to `main`. The workflow uses intelligent change detection to run only the relevant quality gates:

| Workflow     | Jobs                                                                                                                                                                                 | Trigger                             | Enforced By       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------- |
| **cicd.yml** | `detect-changes` (determine what changed) → conditional `ui-quality-gate` / `api-quality-gate` (only if their code changed) → conditional `ui-deploy` (only on main with UI changes) | `push` and `pull_request` to `main` | Branch protection |

The gate jobs become required status checks, meaning:

- **Pushes to main** must pass the gates corresponding to changed code
- **PRs** must pass the gates corresponding to changed code before merge
- **Admins CAN bypass** status checks and merge directly (enforce_admins = false)

**⚠️ Critical:** The `cicd.yml` workflow must be on the `main` branch to be available in the GitHub Actions UI and to trigger on PRs. New workflows added only to feature branches won't show up in GitHub's workflow list until merged to main. **Old workflows must be explicitly disabled** in the GitHub UI if they conflict with the new consolidated workflow.

### Workflow Change Detection

The `detect-changes` job runs first and outputs boolean flags (`ui` and `api`) indicating which parts of the codebase changed:

```yaml
detect-changes:
  outputs:
    ui: ${{ steps.changes.outputs.ui }}
    api: ${{ steps.changes.outputs.api }}
  steps:
    - name: Detect file changes
      run: |
        # For PRs: compare against merge base
        # For pushes: compare against previous commit
        # Output: ui=true/false, api=true/false
```

**Conditional Jobs:**

- `ui-quality-gate` runs only if `detect-changes.outputs.ui == 'true'`
- `api-quality-gate` runs only if `detect-changes.outputs.api == 'true'`
- `ui-deploy` runs only if `github.ref == 'refs/heads/main'` AND `detect-changes.outputs.ui == 'true'`

This prevents unnecessary quality gate runs and delays. If a PR only changes API files, ui-quality-gate doesn't trigger at all.

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

Each subtask corresponds to a step in `.github/workflows/cicd.yml` (ui-quality-gate job):

| Task            | Workflow Step        | Command                                                                                           |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `install`       | Install dependencies | `npm ci && npx husky install`                                                                     |
| `lint-check`    | Check ESLint         | `npx eslint . --report-unused-disable-directives --max-warnings 0`                                |
| `format-check`  | Check Prettier       | `npx prettier . --check`                                                                          |
| `types-check`   | Check TypeScript     | `tsc --noEmit`                                                                                    |
| `test-coverage` | Run tests            | `jest --coverage --coverageThreshold='{"lines":90,"functions":90,"branches":90,"statements":90}'` |
| `security`      | Audit dependencies   | `npm audit --audit-level=high`                                                                    |
| `build`         | Build                | `vite build`                                                                                      |

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

Each subtask corresponds to a step in `.github/workflows/cicd.yml` (api-quality-gate job):

| Task           | Workflow Step        | Command                 |
| -------------- | -------------------- | ----------------------- |
| `install`      | Install dependencies | `uv sync --extra dev`   |
| `lint-check`   | Lint                 | `ruff check .`          |
| `format-check` | Format check         | `ruff format --check .` |
| `test`         | Test                 | `pytest tests/`         |
| `security`     | Security audit       | `pip-audit`             |

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

## 3.5. Git Lint Validation

### Local Hook: `.husky/commit-msg`

The `.husky/commit-msg` hook validates commit messages and is run by Git before every commit:

```sh
./scripts/git-lint.sh commit-msg "$1"
```

Validates that the commit message matches one of two formats (see rules below).

### Validator Script: `scripts/git-lint.sh`

Central script with three validation modes:

| Mode                       | Usage                                                          | Purpose                                |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `commit-msg <msg-file>`    | Called by `.husky/commit-msg` locally; by CI job in batch mode | Validates a single commit message file |
| `branch <branch-name>`     | Called by CI job + `task git-lint` locally                     | Validates a branch name                |
| `pr-commits <base> <head>` | Called by CI `git-lint` job on PR merge                        | Validates all commits in a range       |

**Commit message rules:**

Code commits (feature/bugfix/hotfix/chore):

- Format: `^(feature|bugfix|hotfix|chore)/#[0-9]+: .+$`
- Max header length: 72 characters (git convention)
- No period at end of header
- Examples: `feature/#42: add dark mode`, `bugfix/#137: fix editor crash`, `chore/#149: update deps`

Article commits:

- Format: `^article/[a-z0-9][a-z0-9-]*: (draft|revise|publish)( .+)?$`
- Verb must be: `draft`, `revise`, or `publish`
- Slug must be lowercase alphanumeric with hyphens
- Optional description after verb
- Examples: `article/rust-guide: draft introduction`, `article/rust-guide: revise`, `article/rust-guide: publish`

**Branch name rules:**

- Format: `^(main|(feature|bugfix|hotfix|article|chore)/#[0-9]+/[a-z0-9][a-z0-9-]*)$`
- Allowed prefixes: `feature/#`, `bugfix/#`, `hotfix/#`, `article/#`, `chore/#`
- Issue number: 1+ digits after the `#`
- Slug must be lowercase alphanumeric with hyphens
- `main` branch requires no prefix
- Examples: `feature/#149/git-lint-rules`, `bugfix/#137/editor-crash`, `hotfix/#140/security-patch`

### CI Job: `git-lint` (unconditional)

The `git-lint` job runs on all PRs and pushes to `main`, independent of `detect-changes`. It validates:

1. **Branch name:** Checked from `github.head_ref` (PR) or `github.ref_name` (push)
2. **All commits in range:**
   - For PRs: `origin/base..HEAD`
   - For pushes: `github.event.before..HEAD` (or just `HEAD` if before is all zeros)

```yaml
git-lint:
  name: git-lint
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0 # Full history required for commit validation
    - uses: arduino/setup-task@v2
    - name: Validate branch name
      run: task git-lint BRANCH="${{ github.head_ref || github.ref_name }}"
    - name: Validate commit messages
      run: |
        if [[ "${{ github.event_name }}" == "pull_request" ]]; then
          task git-lint-pr BASE="origin/${{ github.base_ref }}" HEAD="HEAD"
        else
          task git-lint-pr BASE="${{ github.event.before }}" HEAD="HEAD"
        fi
```

### Taskfile Tasks

Three tasks support git linting:

```yaml
git-lint: # Validate current branch
  desc: Validate branch name (current branch)

git-lint-commit: # Validate single message file (MSG=path)
  desc: Validate a single commit message file

git-lint-pr: # Validate PR commits (BASE=... HEAD=...)
  desc: Validate all commit messages in a PR range
```

### How to Modify Git Lint Rules

The rules are defined in `scripts/git-lint.sh`:

1. **To change code commit message format:** Edit the `COMMIT_MSG_CODE_REGEX` variable (line ~30)
2. **To change article commit message format:** Edit the `COMMIT_MSG_ARTICLE_REGEX` variable (line ~32)
3. **To change article verbs:** Update the list in `COMMIT_MSG_ARTICLE_REGEX` (e.g., add `finalize` to `(draft|revise|publish|finalize)`)
4. **To change branch naming rules:** Edit the `BRANCH_NAME_REGEX` variable (line ~26)
5. **Propagation:** Changes to `scripts/git-lint.sh` apply automatically to:
   - Local commits (`.husky/commit-msg` hook)
   - CI (all `git-lint` task calls)
6. **Testing:** Run `task git-lint BRANCH=<name>` locally or test messages with `./scripts/git-lint.sh commit-msg <file>`

---

## 4. Branch Protection (main)

### Current Configuration

| Setting                    | Value                                             | Purpose                                                                   |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| **Required status checks** | `git-lint`, `ui-quality-gate`, `api-quality-gate` | All must pass before merge (unless merged by admin with bypass)           |
| **Strict mode**            | ✓ Enabled                                         | PR must be up to date with base before merge                              |
| **Enforce for admins**     | ✗ Disabled                                        | Admins can push directly to main and merge PRs without waiting for checks |
| **Allow force pushes**     | ✗ Disabled                                        | Prevent rewriting history                                                 |
| **Allow deletions**        | ✗ Disabled                                        | Protect against accidental deletes                                        |

### How to Modify

To add a new required status check:

1. Create a new workflow job (e.g., `security-scan`)
2. Make it a gate job (runs-on: ubuntu-latest, no dependencies except setup steps)
3. Add the job name to this rule's `Required status checks` list
4. Verify on GitHub: Settings → Branches → main → Edit → Require status checks

---

## 5. Deployment Environment (github-pages)

### Current Configuration

| Setting                      | Value                            | Purpose                              |
| ---------------------------- | -------------------------------- | ------------------------------------ |
| **Deployment branch policy** | Custom branch policies (enabled) | Only specific branches can deploy    |
| **Allowed branches**         | `main` (1 policy)                | Only main deploys                    |
| **Require admin approval**   | ✗ Disabled                       | Automatic deployment on push to main |

### Deployment Flow

1. **Push to main** → `cicd.yml` triggers
2. **`detect-changes` runs** → outputs `ui=true` (UI code changed)
3. **`ui-quality-gate` passes** → Vite build artifact uploaded
4. **`ui-deploy` job waits** for `detect-changes` + `ui-quality-gate` + checks `github.ref == 'refs/heads/main'` and `ui == 'true'`
5. **Deployment to `github-pages` environment** occurs
6. **GitHub Pages publishes** to <https://linnienaryshkin.github.io/inkwell/>

---

## 6. GitHub Pages

| Setting          | Value                                        |
| ---------------- | -------------------------------------------- |
| **Source**       | GitHub Actions (workflow)                    |
| **Build status** | ✓ Published                                  |
| **Live URL**     | <https://linnienaryshkin.github.io/inkwell/> |

---

## 7. GitHub Actions Secrets

| Secret Name             | Used By                        | Purpose                                                      |
| ----------------------- | ------------------------------ | ------------------------------------------------------------ |
| `ALLOWED_REDIRECT_URLS` | `api/` (FastAPI)               | Comma-separated OAuth redirect URL allowlist and CORS origin |
| `ANTHROPIC_API_KEY`     | `.github/workflows/claude.yml` | Claude API authentication for AI workflows                   |
| `OAUTH_CLIENT_ID`       | `api/` (FastAPI)               | GitHub OAuth app client ID                                   |
| `OAUTH_CLIENT_SECRET`   | `api/` (FastAPI)               | GitHub OAuth app client secret                               |
| `OAUTH_CALLBACK_URL`    | `api/` (FastAPI)               | GitHub OAuth callback URL                                    |

**How to add a new secret:**

```bash
gh secret set SECRET_NAME --body "value"
gh secret list  # Verify
```

### Environment Variable Source of Truth

| File                    | Purpose                                          | Committed? |
| ----------------------- | ------------------------------------------------ | ---------- |
| `api/.env.example`      | Documents all API secrets/vars with placeholders | ✓ Yes      |
| `ui/.env.example`       | Documents all UI env vars with placeholders      | ✓ Yes      |
| `api/.env` (gitignored) | Local dev; developer fills in real values        | ✗ No       |
| `ui/.env` (gitignored)  | Local dev; developer fills in real values        | ✗ No       |
| GitHub Actions Secrets  | CI/CD with real values                           | Encrypted  |

---

## 7.5. Managing Multiple Workflow Versions

When consolidating or reorganizing CI/CD workflows (e.g., replacing separate `ui-ci.yml` and `api-ci.yml` with `cicd.yml`):

1. **Create the new workflow** on a feature branch and test locally with `task quality-gate`
2. **Merge the feature branch to main** to make the new workflow available in GitHub's workflow list
3. **Disable old workflows** via GitHub UI or CLI:
   ```bash
   gh workflow disable old-workflow-name --repo owner/repo
   ```
4. **Update branch protection** to reference the new job names (if different):

   ```bash
   # View current config
   gh api repos/owner/repo/branches/main/protection

   # Jobs on PRs against main will now reference the new workflow's job names
   ```

5. **Delete old workflow files** from the repository to avoid confusion (optional but recommended)

**Why this matters:** GitHub only recognizes workflows committed to `main`. Workflow files on feature branches won't trigger and won't appear in the Actions UI, even if correctly written. This can cause "checks awaiting conflict resolution" without any actual workflow runs.

---

## 8. How to Make Changes

### Adding a New Quality Check to UI

1. **Edit `ui/Taskfile.yml`:**

   ```yaml
   quality-gate:
     cmds:
       - task: lint-check
       - task: new-check # Add here

   new-check:
     cmds:
       - new-command
   ```

2. **Edit `.github/workflows/cicd.yml` (ui-quality-gate job):**

   ```yaml
   - name: Run new check
     run: task new-check
   ```

3. **Update this rule's section 2** with the new step

4. **The pre-commit hook automatically picks up the Taskfile change**

### Adding a New Required Status Check

1. **Create a new workflow file** (e.g., `.github/workflows/security.yml`) and **merge to main first** to make it available
2. **Define a gate job** (must complete before merge)
3. **Disable any conflicting old workflows** if consolidating:
   ```bash
   gh workflow disable old-workflow-name --repo linnienaryshkin/inkwell
   ```
4. **Verify the new job appears in GitHub's Actions UI** by viewing the workflow runs on main
5. **Update branch protection** (GitHub may auto-update this, but verify):
   ```bash
   gh api repos/linnienaryshkin/inkwell/branches/main/protection
   ```
6. **Update this rule** with the new check name

### Modifying Deployment Settings

1. **Edit `.github/workflows/cicd.yml`** (ui-deploy job conditions)
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
# List all workflows and their status (active/disabled)
gh workflow list --repo linnienaryshkin/inkwell

# Branch protection
gh api repos/linnienaryshkin/inkwell/branches/main/protection

# Deployment environment
gh api repos/linnienaryshkin/inkwell/environments/github-pages

# GitHub Pages config
gh api repos/linnienaryshkin/inkwell/pages

# GitHub Actions secrets
gh secret list --repo linnienaryshkin/inkwell

# Workflow runs on main (to verify recent runs)
gh run list --repo linnienaryshkin/inkwell --branch main --limit 10
```

---

## 10. Keep This Rule Current

### When to Update

- **Workflow file changes** → Update the corresponding Taskfile section
- **Taskfile changes** → Update the workflow if steps differ
- **GitHub settings changes** → Run the verification commands and update this rule
- **Workflow consolidation** → Update section 7.5 with lessons learned
- **New required status checks** → Update section 4 branch protection table

### Verification Process

1. Make the change (workflow, Taskfile, or GitHub settings)
2. Run the corresponding verification command above
3. Update this rule with the new state

---

## 11. Quick Reference: File Locations

| File                           | Purpose                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/cicd.yml`   | Consolidated CI/CD workflow (git-lint, detect-changes, ui-quality-gate, api-quality-gate, ui-deploy jobs); includes comprehensive inline documentation |
| `.github/workflows/claude.yml` | Claude Code Action responder                                                                                                                           |
| `ui/Taskfile.yml`              | UI task definitions (quality-gate source, called from cicd.yml)                                                                                        |
| `api/Taskfile.yml`             | API task definitions (quality-gate source, called from cicd.yml)                                                                                       |
| `.husky/pre-commit`            | Local pre-commit hook (runs both quality-gates)                                                                                                        |
| `.husky/commit-msg`            | Local commit-msg hook (validates commit message format)                                                                                                |
| `scripts/git-lint.sh`          | Canonical git lint validator (commit message + branch name rules)                                                                                      |
| `Taskfile.yml`                 | Root tasks: git-lint, git-lint-commit, git-lint-pr                                                                                                     |
