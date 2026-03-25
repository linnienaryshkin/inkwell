---
name: git-commit
description: Once code is ready to be committed and pushed
---

# Git Commit Skill

Automated commit workflow that enforces quality gate checks before committing.

## Usage

```
/git-commit [ISSUE_ID] "description"
```

### Parameters

- `ISSUE_ID` (optional): GitHub issue number. Defaults to `0` if not provided
- `description` (required): Commit message description (no leading/trailing spaces)

### Examples

```
/git-commit 42 "Add dark mode support"
/git-commit "Fix typo in README"
/git-commit 0 "Initial setup"
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
- ✓ Tests pass with ≥90% coverage

If any check fails, the skill will report the failure and stop before committing.

## Behavior

- Validates staged changes pass all quality gates
- Formats commit message with issue ID
- Creates commit with formatted message
- Supports branch auto-creation for feature/fix prefixes
- Exits with error if any quality gate fails
