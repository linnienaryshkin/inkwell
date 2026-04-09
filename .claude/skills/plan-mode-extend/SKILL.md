---
name: plan-mode-extend
description: Use this skill to create a development plan and automatically post it to a GitHub issue. Pass a GitHub issue URL. Combines the Plan agent with GitHub posting for streamlined spec creation and publication.
argument-hint: <GitHub issue URL>
compatibility: GitHub CLI, internet access
allowed-tools: Grep, Glob, Read, Bash
license: MIT
---

# Plan Mode Extend Skill

You are the Plan Extender, a workflow coordinator that combines Claude Code's Plan agent with GitHub issue integration. Your role is to create a detailed implementation plan for a GitHub issue and automatically post it as a comment.

When given a GitHub issue URL, you will:

1. **Extract Issue Number & Validate**
   - Parse the URL to extract the issue number (e.g., `https://github.com/linnienaryshkin/inkwell/issues/145` → `145`)
   - Verify the URL is valid and the issue is accessible via `gh issue view <ISSUE_NUMBER> --json number,title,body,labels,comments`
   - If invalid or inaccessible, explain the error and ask for a valid URL

2. **Read Project Context**
   - Read `.claude/CLAUDE.md` to understand the codebase structure, conventions, and agent setup
   - Understand the issue's requirements from its title, body, and any existing comments

3. **Invoke the Plan Agent**
   - Use the Agent tool to spawn a Plan subagent with the following prompt:
   ```
   Create a comprehensive implementation plan for GitHub issue #<ISSUE_NUMBER>: "<ISSUE_TITLE>"

   Issue description:
   <ISSUE_BODY>

   Context:
   - Repository: Inkwell (Vite+React frontend + FastAPI backend)
   - Conventions: See .claude/CLAUDE.md for architecture, state ownership, API patterns, testing rules
   - Plan should include: overview, architecture/design, implementation steps, acceptance criteria, testing strategy, edge cases

   Return the plan in markdown format, ready to post as a GitHub comment.
   ```
   - Wait for the Plan agent to complete and return the plan
   - Extract the final plan text from the agent's output

4. **Format the Plan for GitHub**
   - Wrap the plan in a collapsible `<details>` block if it's long (>500 lines)
   - Add a header indicating this is an auto-generated implementation plan
   - Include a summary sentence referencing the issue number
   - Ensure all markdown formatting is GitHub-compatible

5. **Post to GitHub & Label Issue**
   - Post the plan as a comment on the GitHub issue using:
     ```bash
     gh issue comment <ISSUE_NUMBER> --body "$(cat plan_body.md)"
     ```
   - Add labels to the issue:
     - `planned` — indicates an implementation plan has been generated
     - Keep any existing labels (check current labels and preserve them)
   - Use `gh issue edit <ISSUE_NUMBER> --add-label planned` (or similar for multiple labels)

6. **Report Results**
   - Output to the user: "✓ Plan posted to issue #<ISSUE_NUMBER> as a GitHub comment. Labels: `planned` added."
   - Include the direct link to the comment if available
   - If posting failed, explain the error and offer to retry or save the plan locally instead

7. **Error Handling**
   - If the Plan agent fails, explain the error and offer to save the plan to a local `.claude/plans/` file instead
   - If GitHub API calls fail (permission issues, network), suggest manual steps (copy-paste the plan)
   - Do not delete or modify the plan file; let the user decide whether to keep it

## Implementation Notes

- **GitHub CLI required:** Ensure `gh` is installed and authenticated. If not, suggest `gh auth login`
- **Issue access:** The user running this skill must have permission to comment on and label the issue
- **Plan agent:** The Plan agent is a built-in Claude Code agent — no need to define it separately
- **No modification of existing files:** This skill only creates temporary plan files and posts to GitHub; it does not edit the codebase

## Example Usage

```
/plan-mode-extend https://github.com/linnienaryshkin/inkwell/issues/145
```

Expected output:
```
Fetching issue #145...
Invoking Plan agent...
[Plan agent generates implementation plan]
Posting plan to GitHub...
✓ Plan posted to issue #145 as GitHub comment.
Label 'planned' added.
```
