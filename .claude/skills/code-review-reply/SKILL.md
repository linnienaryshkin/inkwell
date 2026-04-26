---
name: code-review-reply
description: Use this skill to fix PR review comments. Processes each comment as a todo item, fixes the code, and resolves/replies to each comment. If a comment is unclear, raises a question in a reply instead. If a comment is incorrect, replies with justification without closing the comment.
argument-hint: <PR URL or number>
compatibility: GitHub CLI, internet access
license: MIT
---

# Code Review Reply Skill

## Usage

```
/code-review-reply $ARGUMENTS
```

## Process

Fetch all PR review comments, create a todo list (one per comment), then iterate through each — fix the code, and reply/resolve accordingly.

### Step 0 — Fetch PR and Comments

Use `gh` CLI to fetch PR details and all review comments:

```bash
gh pr view <PR_NUMBER>              # Get PR metadata
gh pr view <PR_NUMBER> --json reviews  # Get all review comments
```

Create a **task list** with one task per comment. Mark each as completed once the comment is handled.

---

## Comment Processing Rules

For each comment, determine the action:

### 1. **Clear Issue → Fix Code**

If the comment clearly describes a problem:

- **Fix the code** in the relevant file
- **Reply to the comment** with a brief acknowledgment: `Done — fixed in commit [hash].`
- **Resolve the comment** (mark as resolved)

### 2. **Unclear Comment → Ask for Clarification**

If the comment is vague or you don't understand the request:

- **Do NOT guess** — ask for clarification in a reply
- Keep the comment **unresolved**
- Example reply: `Can you clarify what you mean by "optimize this"? Which aspect should I focus on?`

### 3. **Incorrect/Unjustified Comment → Defend with Justification**

If you believe the comment is wrong or the current code is correct:

- **Reply with justification** — explain why the code is correct or why the suggestion doesn't apply
- **Do NOT resolve the comment** — leave it open for the reviewer to respond
- Example reply: `This is intentional — we use the longer form to match project conventions in CLAUDE.md. See [url] for rationale.`

---

## Reply Format

Each reply to a PR comment follows this pattern:

```
<action taken or response — one to two sentences>

> Via Claude Code
```

**Examples:**

✅ Fix acknowledged:

```
Done — updated the error handling to catch 404s as specified.

> Via Claude Code
```

❓ Need clarification:

```
I'm not sure which specific behavior you'd like changed. Can you provide an example or point to the relevant code section?

> Via Claude Code
```

⚠️ Defending the code:

```
This follows the state ownership pattern defined in CLAUDE.md — global state lives in StudioPage. The current structure is correct per project conventions.

> Via Claude Code
```

---

## Workflow

1. **Fetch all comments** from the PR review thread
2. **Create task list** — one task per comment (subject: comment author + summary)
3. **Iterate comment-by-comment:**
   - Read the comment in full context
   - Decide: Fix → Ask → Defend?
   - If **Fix**: edit code, commit, reply, resolve
   - If **Ask**: reply with clarifying question, leave unresolved
   - If **Defend**: reply with justification, leave unresolved
   - Mark task completed
4. **Post final summary comment** once all comments are processed:

   ```
   ## Review Comments Processed

   - ✅ <count> comments addressed
   - ❓ <count> awaiting clarification
   - ⚠️ <count> defended / under discussion

   > Via Claude Code
   ```

---

## Git Commits

After fixing code from comments, commit with the format:

```
review/#<PR>: address <comment-summary>
```

Example: `review/#42: fix error handling in article deletion`

Push changes (the git-agent will handle this if needed).

---

## Notes

- **One comment = one task** — track progress explicitly
- **Never resolve a comment you didn't fix or address** — if unclear or defended, leave it open
- **Ask instead of guessing** — if the comment is vague, clarify first
- **Be respectful** — defend the code with context and references, not dismissively
- **Group related fixes** into a single commit if they address the same logical issue
