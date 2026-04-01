# Claude Code Documentation Reference

Specific documentation links for each `[cert]` issue in the Inkwell repo.
All URLs are from the canonical index at <https://code.claude.com/docs/llms.txt>.

---

## Domain 1 – Agentic Architecture & Orchestration

### Issue #91 — 1.1: Agentic loop for autonomous article processing

**Topic:** The agentic loop lifecycle, `stop_reason` inspection, tool result appending.

- <https://code.claude.com/docs/en/how-claude-code-works> — *The agentic loop* section covers gather→act→verify phases, tool use and `stop_reason`

### Issue #92 — 1.2: Multi-agent article research with coordinator-subagent pattern

**Topic:** Hub-and-spoke coordinator architecture, subagent context isolation, dynamic delegation.

- <https://code.claude.com/docs/en/agent-teams> — Orchestrate teams of Claude Code sessions (shared task list, inter-agent messaging, coordinator patterns)
- <https://code.claude.com/docs/en/sub-agents> — Create custom subagents (how subagents are spawned and return results to a coordinator)

### Issue #93 — 1.3: Subagent spawning and context passing

**Topic:** `Task`/`Agent` tool, `allowedTools: ["Task"]`, explicit context passing in spawn prompt, parallel spawning.

- <https://code.claude.com/docs/en/sub-agents> — *Configure subagents* and *Available tools* sections; `tools` frontmatter, parallel subagent invocation
- <https://code.claude.com/docs/en/agent-teams> — Agent teams architecture, how spawn prompts work

### Issue #94 — 1.4: Multi-step publish workflow with programmatic enforcement

**Topic:** Programmatic prerequisite gates (hooks), difference between hook enforcement vs prompt-based guidance, structured handoff protocols.

- <https://code.claude.com/docs/en/hooks> — Hooks reference: `PreToolUse` exit code 2 for blocking, enforcement patterns
- <https://code.claude.com/docs/en/hooks-guide> — Automate workflows with hooks: practical enforcement examples

### Issue #95 — 1.5: Agent SDK hooks for tool call interception

**Topic:** `PostToolUse` hooks for normalising tool results, `PreToolUse` for blocking/redirecting, hook input/output schemas.

- <https://code.claude.com/docs/en/hooks> — Hooks reference: `PreToolUse`, `PostToolUse` events, exit codes, input/output schemas
- <https://code.claude.com/docs/en/hooks-guide> — Automate workflows with hooks: real examples of interception patterns

### Issue #96 — 1.6: Task decomposition strategies for code review workflow

**Topic:** Prompt chaining (fixed sequential) vs adaptive decomposition, per-file passes then cross-file integration pass.

- <https://code.claude.com/docs/en/common-workflows> — *Use plan mode for safe code analysis* and multi-step workflows
- <https://code.claude.com/docs/en/best-practices> — Task decomposition and iterative refinement patterns

### Issue #97 — 1.7: Session state, resumption, and forking

**Topic:** `--resume <session-name>`, `--fork-session`, informing agent about changed files.

- <https://code.claude.com/docs/en/how-claude-code-works> — *Resume or fork sessions* section: `--continue`, `--resume`, `--fork-session` flags
- <https://code.claude.com/docs/en/cli-reference> — CLI reference: all `--resume` / `--continue` / `--fork-session` flags

---

## Domain 2 – Tool Design & MCP Integration

### Issue #98 — 2.1: Clear MCP tool interfaces for Inkwell API

**Topic:** Tool descriptions as primary selection mechanism, input formats, example queries, boundary explanations.

- <https://code.claude.com/docs/en/mcp> — *Connect Claude Code to tools via MCP*: tool description best practices, tool naming
- <https://code.claude.com/docs/en/tools-reference> — Tools reference: how built-in tool descriptions are structured (model for writing your own)

### Issue #99 — 2.2: Structured error responses for Inkwell MCP tools

**Topic:** `isError` flag, error type taxonomy (transient vs validation vs business vs permission), structured error metadata.

- <https://code.claude.com/docs/en/mcp> — MCP tool error handling, `isError` flag, server configuration
- <https://code.claude.com/docs/en/tools-reference> — Tools reference: how tool errors surface back to the agent

### Issue #100 — 2.3: Tool distribution across agents and `tool_choice`

**Topic:** Scoped tool access per agent role, `tool_choice: "any"` for forced structured response, `allowedTools` / `disallowedTools`.

- <https://code.claude.com/docs/en/sub-agents> — *Control subagent capabilities*: `tools` allowlist, `disallowedTools` denylist, per-subagent scoping
- <https://code.claude.com/docs/en/tools-reference> — Tools reference: all available tool names for `allowedTools` configuration

### Issue #101 — 2.4: Integrate MCP servers into Claude Code

**Topic:** Project-scoped `.mcp.json`, user-level `~/.claude.json`, env var expansion, MCP resources.

- <https://code.claude.com/docs/en/mcp> — *Configure MCP servers*: project vs user scope, `.mcp.json` format, env var expansion, resources
- <https://code.claude.com/docs/en/settings> — Settings scopes and how MCP config interacts with settings layers

### Issue #102 — 2.5: Built-in tools (Read, Write, Edit, Bash, Grep, Glob) effectively

**Topic:** Choosing the right tool for each operation, when Edit fails (non-unique text), fallback to Read+Write.

- <https://code.claude.com/docs/en/tools-reference> — Tools reference: complete description of Read, Write, Edit, Bash, Grep, Glob with usage notes
- <https://code.claude.com/docs/en/common-workflows> — *Explore codebases* workflow: practical tool selection guidance

---

## Domain 3 – Claude Code Configuration & Workflows

### Issue #103 — 3.1: CLAUDE.md hierarchy and modular rules for monorepo

**Topic:** User / project / subdirectory CLAUDE.md hierarchy, `@import`, moving rules to `.claude/rules/`.

- <https://code.claude.com/docs/en/memory> — *CLAUDE.md files*: hierarchy table, `@import` syntax, `.claude/rules/` directory, load order
- <https://code.claude.com/docs/en/claude-directory> — Explore the `.claude` directory: structure and purpose of each subdirectory

### Issue #104 — 3.2: Custom slash commands and skills

**Topic:** `.claude/commands/` vs `~/.claude/commands/`, `context: fork`, `allowed-tools`, `argument-hint` frontmatter.

- <https://code.claude.com/docs/en/skills> — Extend Claude with skills: SKILL.md frontmatter reference, `context: fork`, `allowed-tools`, `argument-hint`, `disable-model-invocation`
- <https://code.claude.com/docs/en/commands> — Built-in commands reference (contrast with custom commands)

### Issue #105 — 3.3: Path-specific rules for conditional convention loading

**Topic:** `.claude/rules/` files with YAML `paths:` frontmatter, glob patterns, conditional rule activation.

- <https://code.claude.com/docs/en/memory> — *Organize rules with `.claude/rules/`* and *Path-specific rules* sections: `paths` frontmatter, glob patterns, load-on-demand behaviour

### Issue #106 — 3.4: Plan mode vs direct execution

**Topic:** When to use plan mode (complex/multi-file/architectural), when to use direct execution, Explore subagent during planning.

- <https://code.claude.com/docs/en/permission-modes> — Choose a permission mode: `plan` mode description and when to use it
- <https://code.claude.com/docs/en/common-workflows> — *Use plan mode for safe code analysis*: step-by-step guide
- <https://code.claude.com/docs/en/sub-agents> — Built-in Explore and Plan subagents used during planning phase

### Issue #107 — 3.5: Iterative refinement techniques

**Topic:** Concrete input/output examples, test-driven iteration (write tests first), interview pattern before implementing.

- <https://code.claude.com/docs/en/best-practices> — Best practices: few-shot examples, test-driven prompting, iterative refinement patterns
- <https://code.claude.com/docs/en/common-workflows> — *Fix bugs* and *Write tests* workflows: iterative feedback loops

### Issue #108 — 3.6: Integrate Claude Code into CI/CD pipeline

**Topic:** `-p` / `--print` flag, `--output-format json`, `--json-schema`, independent review instance, CLAUDE.md for CI context.

- <https://code.claude.com/docs/en/headless> — Run Claude Code programmatically: `-p`, `--output-format json`, `--json-schema`, `--bare` for CI
- <https://code.claude.com/docs/en/github-actions> — Claude Code GitHub Actions: workflow YAML, `@claude` trigger, structured output in CI
- <https://code.claude.com/docs/en/code-review> — Code Review: automatic PR review integration

---

## Domain 4 – Prompt Engineering & Structured Output

### Issue #109 — 4.1: Prompts with explicit criteria to reduce false positives

**Topic:** Explicit criteria over vague instructions, concrete severity thresholds, category-based filtering.

- <https://code.claude.com/docs/en/best-practices> — Prompt precision: explicit criteria, specificity, avoiding vague instructions

### Issue #110 — 4.2: Few-shot prompting for output consistency

**Topic:** 2–4 few-shot examples, demonstrating ambiguous-case handling, consistent JSON output format.

- <https://code.claude.com/docs/en/best-practices> — Best practices: few-shot examples as the most effective technique for format consistency

### Issue #111 — 4.3: Enforce structured output via tool use and JSON schemas

**Topic:** `tool_use` with JSON schema for guaranteed schema-compliant output, `tool_choice` variants, nullable optional fields.

- <https://code.claude.com/docs/en/headless> — `--json-schema` flag for enforcing structured output in CLI/CI
- <https://code.claude.com/docs/en/tools-reference> — Tools reference: how tool schemas are defined (model for writing extraction tools)

### Issue #112 — 4.4: Validation, retry, and feedback loops for metadata extraction

**Topic:** Retry-with-error-feedback pattern, appending validation errors to the prompt, `detected_pattern` tracking.

- <https://code.claude.com/docs/en/best-practices> — Iterative correction patterns, retry strategies
- <https://code.claude.com/docs/en/hooks-guide> — `PostToolUse` hooks for triggering validation and feedback loops after extraction

### Issue #113 — 4.5: Batch processing strategy for article analysis

**Topic:** Real-time API vs Message Batches API, 50% cost savings, `custom_id` correlation, resubmit-only-failed pattern.

- <https://code.claude.com/docs/en/costs> — Manage costs effectively: batch processing, cost reduction strategies
- <https://code.claude.com/docs/en/headless> — Programmatic batch invocation patterns with `-p` and session IDs

### Issue #114 — 4.6: Multi-instance and multi-pass review architecture

**Topic:** Per-file local passes + cross-layer integration pass, independent reviewer instance (no self-review bias).

- <https://code.claude.com/docs/en/agent-teams> — Parallel reviewer teammates with independent context windows
- <https://code.claude.com/docs/en/sub-agents> — Spawning independent subagents for separate review passes
- <https://code.claude.com/docs/en/code-review> — Code Review: independent review instance patterns

---

## Domain 5 – Context Management & Reliability

### Issue #115 — 5.1: Manage conversation context across long sessions

**Topic:** Trimming verbose tool outputs, "case facts" persistent block, `/compact`, `lost-in-the-middle` effect.

- <https://code.claude.com/docs/en/how-claude-code-works> — *The context window* and *When context fills up* sections: compaction, what gets preserved
- <https://code.claude.com/docs/en/context-window> — Explore the context window: interactive walkthrough of what loads and when
- <https://code.claude.com/docs/en/costs> — Reduce token usage: output trimming, context management strategies

### Issue #116 — 5.2: Escalation and ambiguity resolution for publish agent

**Topic:** Escalation triggers (explicit request, policy gap, can't progress), autonomous vs escalate decision points.

- <https://code.claude.com/docs/en/best-practices> — Escalation patterns, when to ask vs proceed autonomously
- <https://code.claude.com/docs/en/how-claude-code-works> — *Control what Claude can do* and permission prompts for ambiguous operations

### Issue #117 — 5.3: Error propagation across multi-agent workflows

**Topic:** Structured error context (failure type, partial results, attempted query), coordinator recovery from subagent failure.

- <https://code.claude.com/docs/en/sub-agents> — Subagent result handling; how subagents return summaries (including partial results) to coordinator
- <https://code.claude.com/docs/en/agent-teams> — Teammate error handling, task status management, recover from stuck tasks

### Issue #118 — 5.4: Context management during large codebase exploration

**Topic:** Scratchpad files (`.claude/scratchpad.md`), `/compact`, subagents for targeted queries, context degradation symptoms.

- <https://code.claude.com/docs/en/context-window> — Explore the context window: what fills context, when to compact
- <https://code.claude.com/docs/en/how-claude-code-works> — Context window management, `/compact` command
- <https://code.claude.com/docs/en/sub-agents> — Using Explore subagent to keep verbose file-read output out of main context
- <https://code.claude.com/docs/en/memory> — Scratchpad/persistent notes via CLAUDE.md and auto memory across context boundaries

### Issue #119 — 5.5: Human review workflows and confidence calibration

**Topic:** Stratified random sampling, field-level confidence scores, routing low-confidence findings to human review.

- <https://code.claude.com/docs/en/best-practices> — Human-in-the-loop patterns, confidence calibration, when to escalate to human review
- <https://code.claude.com/docs/en/hooks-guide> — Using hooks to route low-confidence outputs to a review queue

### Issue #120 — 5.6: Preserve information provenance in multi-source synthesis

**Topic:** Structured claim-source mappings (URL, excerpt, date), annotating conflicting statistics, temporal disambiguation.

- <https://code.claude.com/docs/en/sub-agents> — Subagent output schemas: requiring structured claim-source mappings in subagent return values
- <https://code.claude.com/docs/en/best-practices> — Multi-source synthesis patterns, structured output for provenance preservation

---

## Quick Reference: Documentation by Topic

| Topic | Primary URL |
|---|---|
| Agentic loop | <https://code.claude.com/docs/en/how-claude-code-works> |
| Subagents (spawning, config, tools) | <https://code.claude.com/docs/en/sub-agents> |
| Agent teams (parallel sessions) | <https://code.claude.com/docs/en/agent-teams> |
| Hooks (PreToolUse, PostToolUse, events) | <https://code.claude.com/docs/en/hooks> |
| Hooks (practical guide) | <https://code.claude.com/docs/en/hooks-guide> |
| MCP (servers, tools, resources) | <https://code.claude.com/docs/en/mcp> |
| CLAUDE.md & memory | <https://code.claude.com/docs/en/memory> |
| `.claude/rules/` & path-specific rules | <https://code.claude.com/docs/en/memory> (§ Organize rules) |
| Skills & slash commands | <https://code.claude.com/docs/en/skills> |
| Built-in commands | <https://code.claude.com/docs/en/commands> |
| Built-in tools (Read/Write/Edit/Bash/Grep/Glob) | <https://code.claude.com/docs/en/tools-reference> |
| Permission modes (plan, auto, bypassPermissions) | <https://code.claude.com/docs/en/permission-modes> |
| Permissions (allow/deny rules) | <https://code.claude.com/docs/en/permissions> |
| Session resume / fork | <https://code.claude.com/docs/en/how-claude-code-works> |
| Programmatic / CI (headless, -p flag) | <https://code.claude.com/docs/en/headless> |
| GitHub Actions CI/CD | <https://code.claude.com/docs/en/github-actions> |
| Automatic code review | <https://code.claude.com/docs/en/code-review> |
| Context window & compaction | <https://code.claude.com/docs/en/context-window> |
| Cost & token management | <https://code.claude.com/docs/en/costs> |
| Best practices | <https://code.claude.com/docs/en/best-practices> |
| Common workflows | <https://code.claude.com/docs/en/common-workflows> |
| Settings & scopes | <https://code.claude.com/docs/en/settings> |
| .claude directory structure | <https://code.claude.com/docs/en/claude-directory> |
| CLI reference | <https://code.claude.com/docs/en/cli-reference> |
| All 75 pages index | <https://code.claude.com/docs/llms.txt> |
