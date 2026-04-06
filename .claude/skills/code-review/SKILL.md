---
name: code-review
description: Use this skill when the user wants to review a pull request — pass a PR URL or number as the argument. Invoke for requests like "review this PR", "check PR #42", or "look at my pull request", even if the user doesn't say "code review". Runs four focused passes (correctness, security, conventions, tests) and posts inline GitHub comments signed "Generated with Claude Code".
argument-hint: <PR URL or number>
compatibility: GitHub CLI, internet access
license: MIT
---

# Code Review Skill

## Usage

```
/code-review $ARGUMENTS
```

## Process

Fetch the PR, then run **four focused passes** in sequence. Each pass has a single concern — this prevents attention dilution across large diffs.

### Step 0 — Fetch PR context

Use `gh` CLI to fetch PR details:
```bash
gh pr view <PR_NUMBER>      # Get PR metadata (title, body, base/head refs)
gh pr view <PR_NUMBER> --json files  # Get list of changed files
gh pr diff <PR_NUMBER>      # Get the PR diff
```

Read `.claude/CLAUDE.md` for project conventions before reviewing.

---

### Pass 1 — Correctness & Logic

Focus exclusively on bugs, wrong logic, off-by-one errors, missing error handling, race conditions, and broken edge cases. Ignore style, naming, and tests in this pass.

Questions to ask per file:
- Can this throw / return wrong data under any input?
- Are all API error cases handled (404, 409, 5xx)?
- Does state update correctly in all branches?
- Are async operations awaited / cancelled properly?

---

### Pass 2 — Security & Safety

Focus exclusively on security issues. Ignore everything else.

Check for:
- User input used in shell commands, SQL, or HTML without sanitisation (injection, XSS)
- Secrets or credentials committed to the repo
- CORS, authentication, or authorisation gaps in new API endpoints
- Unsafe dependency updates (`npm audit`, known CVEs)
- `dangerouslySetInnerHTML` or `eval` usage

---

### Pass 3 — Conventions & Architecture

Focus exclusively on adherence to project rules. Ignore correctness and security (already covered).

Check against `.claude/CLAUDE.md` conventions:
- **State ownership**: global state must live in `StudioPage`; component-local state stays local
- **Styling**: CSS variables only — no hardcoded colors; Tailwind for layout/spacing
- **Type ownership**: `Article` type imported from `studio/page.tsx`, never redefined
- **Path alias**: `@/` used for all internal imports
- **API conventions**: Pydantic models match UI `Article` type; correct HTTP status codes
- **Test file placement**: colocated `FileName.test.{ts,tsx}` for UI; `api/tests/` for API

---

### Pass 4 — Tests & Coverage

Focus exclusively on test quality. Ignore everything already covered.

Check:
- New code has corresponding tests
- Tests follow BDD: test behavior, not internals
- UI query priority respected: `getByRole` > `getByLabelText` > `getByText` > `data-testid`
- External libraries mocked (Monaco, ReactMarkdown); internal components NOT mocked
- API tests grouped by resource using classes (`TestListArticles`, `TestGetArticle`, etc.)
- 90% coverage threshold not degraded — run `npm run test:coverage` / `uv run pytest tests/ -v` if needed

---

## Posting Comments

After all four passes, post findings as inline PR review comments using `gh` CLI.

**Rules:**
- Post **inline comments** on the specific file + line where the issue occurs
- Group comments by review to keep feedback organized
- Only comment on real issues — do not add praise or filler ("looks good", "nice work")
- Each comment must be concise: one sentence stating the problem, one sentence stating the fix
- Every comment **must** end with the attribution line:

  ```
  > Generated with Claude Code
  ```

**Comment format:**

```
<issue description — one sentence>

<suggested fix or guidance — one sentence>

> Generated with Claude Code
```

**Posting the review:**

Use `gh` CLI to post review comments:
```bash
gh pr review <PR_NUMBER> --comment --body "comment text"
```
Or post multiple comments as review threads targeting specific lines.

---

## Severity Labels

Prefix each comment with a severity tag:

- `[BLOCKER]` — must fix before merge (correctness, security)
- `[MAJOR]` — strong recommendation (convention violation, missing test coverage)
- `[MINOR]` — optional improvement (naming, simplification)
- `[NIT]` — trivial style or whitespace (only include if genuinely useful)

Skip `[NIT]` comments if there are `[BLOCKER]` or `[MAJOR]` issues — prioritise signal.

---

## Final Summary Comment

After inline comments, post one top-level review summary:

```
## Review Summary

**Passes completed:** Correctness, Security, Conventions, Tests

**Findings:**
- [BLOCKER] <count>
- [MAJOR] <count>
- [MINOR] <count>

**Verdict:** APPROVE / REQUEST CHANGES / COMMENT

<one sentence overall assessment>

> Generated with Claude Code
```

Post with `gh pr review` using `--approve`, `--request-changes`, or `--comment` depending on verdict.
