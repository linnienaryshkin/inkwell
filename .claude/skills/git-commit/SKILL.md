---
name: git-commit
description: Once code is ready to be committed and pushed
---

# Git Commit Skill

## Usage

```
/git-commit [ISSUE_ID] ["description"]
```

Both parameters are optional. If `description` is omitted, inspect staged diff (`git diff --staged`) and auto-generate a concise, imperative-mood message — do not ask the user.

## Quality Gate (run in order, stop on failure)

1. `npm run format:check`
2. `npm run types:check`
3. `npm run lint:check`
4. `npm run test:coverage` — must pass with ≥90% branch coverage
5. `npm run security` — `npm audit --audit-level=high`; fails on high/critical vulnerabilities

If coverage is below 90%: review the report, remove untestable dead code, add tests, rerun.

## Commit

Message format:

```
#ISSUE: description

Co-Authored-By: Claude Code <noreply@anthropic.com>
```

`ISSUE` defaults to `0` when not provided.
