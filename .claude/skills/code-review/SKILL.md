---
name: code-review
description: Use this skill when the user wants to review a pull request — pass a PR URL or number as the argument. Invoke for requests like "review this PR", "check PR #42", or "look at my pull request", even if the user doesn't say "code review". Runs four focused passes (correctness, security, conventions, tests) and posts inline GitHub comments signed "Generated with Claude Code".
argument-hint: <PR URL or number>
compatibility: gh, internet access
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

```bash
gh pr view <PR> --json number,title,body,baseRefName,headRefName,files,additions,deletions
gh pr diff <PR>
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

After all four passes, post findings as inline PR review comments using `gh pr review`.

**Rules:**
- Post **inline comments** on the specific file + line where the issue occurs, not a single top-level comment
- Group all comments into a single `gh pr review` call using `--comment` flags so they appear as one review
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

```bash
gh pr review <PR> --comment \
  --body "$(cat <<'EOF'
<!-- summary of all findings across all passes, or "No issues found." -->

> Generated with Claude Code
EOF
)"
```

For inline comments on specific lines use:

```bash
gh api repos/{owner}/{repo}/pulls/<PR>/comments \
  --method POST \
  --field body='<comment text>

> Generated with Claude Code' \
  --field commit_id='<head SHA>' \
  --field path='<file path>' \
  --field line=<line number> \
  --field side='RIGHT'
```

Get the head SHA with:
```bash
gh pr view <PR> --json headRefOid --jq '.headRefOid'
```

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

Post with `gh pr review <PR> --approve` or `--request-changes` or `--comment` depending on verdict.
