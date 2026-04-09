# Plan: Git Lint Rules (Issue #149)

## Context

The project currently enforces code quality (lint, format, tests) in CI and via the pre-commit hook, but has no enforcement of git hygiene — commit message format and branch naming are documented in CLAUDE.md but never validated automatically. Issue #149 asks for CI/CD-level git lint rules that handle the different development flows (feature, bugfix, hotfix, article). The referenced repo uses commitlint, but that requires conventional commits which conflict with Inkwell's bespoke `#ISSUE: description` format, so we use a custom shell script instead.

## Decisions

- **Keep existing commit format:** `#ISSUE: description` (e.g. `#42: add dark mode`). No switch to conventional commits — that would break the Claude git-agent workflow.
- **Custom shell script** over commitlint/gitlint — zero dependencies, works identically locally and in CI, no root `package.json` needed.
- **Branch naming convention:** `feature/`, `bugfix/`, `hotfix/`, `article/`, `chore/` prefixes + bare `main`. Slugs must be lowercase kebab-case.
- **Both local and CI:** `.husky/commit-msg` for local fast-fail; new `git-lint` CI job for safety net (catches `--no-verify` bypasses and GitHub web editor commits).

## Implementation Steps

### 1. Create `scripts/git-lint.sh` (new file)

Central validator with three modes:
- `commit-msg <msg-file>` — validates a single commit message file
- `branch <branch-name>` — validates a branch name
- `pr-commits <base> <head>` — validates all commits in a range

**Commit message rules:**
- Regex: `^#[0-9]+: .+$`
- Max header length: 72 characters
- Description must not end with `.`

**Branch name regex:** `^(main|(feature|bugfix|hotfix|article|chore)/[a-z0-9][a-z0-9-]*)$`

Handle edge case: if `base` is all zeros (first push to new branch), validate only `HEAD`.

### 2. Create `.husky/commit-msg` (new file)

```sh
#!/usr/bin/env sh
./scripts/git-lint.sh commit-msg "$1"
```

### 3. Update root `Taskfile.yml`

In `install` task, add `chmod` lines:
```yaml
- chmod +x .husky/commit-msg
- chmod +x scripts/git-lint.sh
```

Add new tasks:
```yaml
git-lint:
  desc: Validate branch name (current branch)
  ...
git-lint-commit:
  desc: Validate a commit message file (MSG=path)
  ...
git-lint-pr:
  desc: Validate all commits in PR range (BASE=... HEAD=...)
  ...
```

### 4. Add `git-lint` job to `.github/workflows/cicd.yml`

- Runs unconditionally (no `detect-changes` dependency) on all PRs and pushes to `main`
- Uses `fetch-depth: 0` for full history
- Steps: validate branch name + validate all commits in range
- Add to required status checks in CI (and update branch protection docs)

```yaml
git-lint:
  name: git-lint
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 0 }
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

### 5. Update `CLAUDE.md`

In the Git Workflow section, add:
- Branch naming convention table
- Note that `commit-msg` hook validates locally
- `task git-lint` for manual branch check

### 6. Update `.claude/rules/github.md`

- Add `scripts/git-lint.sh` and `.husky/commit-msg` to `paths:` frontmatter
- Add new section: "Git Lint" — documents the script, hook, CI job, regexes, how to modify
- Update Section 4 (Branch Protection) to include `git-lint` as required status check
- Update Section 11 (Quick Reference) with new files

## Critical Files

| File | Action |
|------|--------|
| `scripts/git-lint.sh` | **Create** |
| `.husky/commit-msg` | **Create** |
| `Taskfile.yml` | **Modify** — add chmod + git-lint tasks |
| `.github/workflows/cicd.yml` | **Modify** — add git-lint job |
| `CLAUDE.md` | **Modify** — document branch convention |
| `.claude/rules/github.md` | **Modify** — document new git lint setup |

## Verification

1. **Local hook:** `git commit --allow-empty -m "bad message"` → should fail with clear error
2. **Local hook:** `git commit --allow-empty -m "#0: test commit"` → should succeed
3. **Branch validation:** `task git-lint BRANCH=feature/my-feature` → passes; `task git-lint BRANCH=my-feature` → fails
4. **CI:** Open a PR with a correctly named branch and valid commits → `git-lint` job passes
5. **CI:** Open a PR with a bad commit message → `git-lint` job fails with clear error output
