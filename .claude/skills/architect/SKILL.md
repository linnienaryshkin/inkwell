---
name: architect
description: Write elaborate technical specifications from GitHub issues
disable-model-invocation: true
---

# Architect Skill

Turns a GitHub issue $ARGUMENTS into a detailed technical spec, then posts it as a comment on the issue.

## Usage

```
/architect <GITHUB_ISSUE_URL>
```

## Workflow

### 1. Fetch & Analyze

Read the issue (title, body, labels). Identify scope (UI, API, integration, etc.) and extract explicit + implicit requirements.

### 2. Clarify

Ask targeted questions to fill gaps. Present 2–3 architectural options for key decisions:

```
Option A: [Name]
- Pros / Cons / Best for

Option B: [Name] (Recommended)
- Pros / Cons / Best for
```

Wait for user selection before writing the spec.

### 3. Write the Spec

Cover all relevant sections:

- **Overview** — problem and solution
- **Architecture** — components and interactions
- **Data Flow** — how data moves; diagram if complex
- **API Design** — endpoints, request/response shapes (if applicable)
- **UI/UX Changes** — component hierarchy, state, styling, screenshots of current state (if applicable)
- **Implementation Plan** — ordered, actionable steps
- **Testing Strategy** — unit / integration / E2E, note any coverage limitations
- **Edge Cases & Error Handling** — specific behavior, not just "handle X"
- **Future Considerations** — scalability, maintenance, evolution

### 4. Post to GitHub

Add the spec as a comment on the issue.

### 5. Label issue

Add an `refined` label to issue.

---

## What Makes a Good Spec

These gaps caused real implementation rework — watch for them:

**Screenshots**: For UI/UX tasks, take a playwright-mcp screenshot of `http://localhost:3000/studio` and embed it in the spec to anchor the before-state.

**State flow**: Specify what owns state, what transforms it, and when updates happen. Include a wiring diagram for multi-hook features:

```
StudioPage (owns editorRef, content)
  → SidePanel → TocTab
      ├─ useHeadingExtraction(content) → Heading[]
      ├─ useScrollTracking(editorRef, Heading[]) → currentHeadingId
      └─ onClick → navigate(id) → editor scrolls
```

**Third-party APIs**: Include actual API calls for complex integrations (e.g., Monaco). Note what can't be tested in Jest and suggest workarounds.

**Acceptance criteria**: Use specific, testable behavior — not "scroll works" but "clicking TOC entry scrolls editor, centering heading in viewport with smooth animation; if heading is deleted, disable scroll silently."

**Line number instability**: If content can change at runtime, note that line numbers shift. Use IDs as the source of truth; look up line numbers fresh at use time.

**Testing gaps**: Call out upfront what's hard to test (e.g., Monaco scroll events). Set realistic coverage expectations and suggest mock strategies.

**Performance budgets**: Specify where it matters ("heading extraction must not block typing", "debounce keystrokes to 300ms").

**Error handling**: Every edge case needs a specified behavior — not just identification.
