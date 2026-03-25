---
name: git-commit
description: Once code is ready to be committed and pushed
---

# Git Commit Skill

Automated commit workflow that enforces quality gate checks before committing.

## Usage

```
/git-commit [ISSUE_ID] ["description"]
```

### Parameters

- `ISSUE_ID` (optional): GitHub issue number. Defaults to `0` if not provided
- `description` (optional): Commit message description. If omitted, auto-generate from staged files using `git diff --staged`

### Examples

```
/git-commit 42 "Add dark mode support"
/git-commit "Fix typo in README"
/git-commit 0 "Initial setup"
/git-commit 42
/git-commit
```

## Workflow

1. **Format Check** — `npm run format:check` (Prettier)
2. **Type Check** — `npm run types:check` (TypeScript)
3. **Lint Check** — `npm run lint:check` (ESLint)
4. **Test Coverage** — `npm run test:coverage` (Jest with 90% threshold)
5. **Create Commit** — Message format: `#ISSUE: description`
6. **Branch** — Auto-creates `#ISSUE:title` branches when needed

## Commit Message Format

```
#ISSUE: description
```

Where:

- `ISSUE` = GitHub issue ID (0 if none)
- `description` = Clear, concise change summary

### Examples

```
#42: Add dark mode support
#0: Fix EditorPane test coverage
#123: Implement article versioning
```

## Quality Gate Requirements

All checks must pass:

- ✓ Code formatted with Prettier
- ✓ No TypeScript errors
- ✓ No ESLint warnings
- ✓ Tests pass with ≥90% branch coverage

If any check fails, the skill will report the failure and stop before committing.

### Coverage Below Threshold?

If branch coverage is below 90%:

1. **Review coverage report** — Look at which code paths lack tests
2. **Ensure code is testable** — Remove non-functional or untestable code (hooks, dead code, etc.)
3. **Add tests** — Write tests for remaining code paths
4. **Verify coverage** — Run `npm run test:coverage` locally before committing

Only push code that meets all quality gates.

## Auto-generating the description

If no `description` is provided, run `git diff --staged --stat` and `git diff --staged` to inspect what is staged, then derive a concise, imperative-mood description from the actual changes (e.g. file names, added/removed symbols, intent). Do **not** ask the user — infer it silently and proceed.

## Behavior

- Validates staged changes pass all quality gates
- Formats commit message with issue ID
- If description is missing, auto-generates it from staged diff
- Creates commit with formatted message
- Supports branch auto-creation for feature/fix prefixes
- Exits with error if any quality gate fails
