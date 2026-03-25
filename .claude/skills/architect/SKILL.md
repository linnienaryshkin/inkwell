---
name: architect
description: Write elaborate technical specifications from GitHub issues
---

# Architect Skill

Transforms GitHub issues into detailed technical specifications by gathering requirements, exploring alternatives, and documenting implementation plans.

## Usage

```
/architect <GITHUB_URL>
/architect https://github.com/linnienaryshkin/inkwell/issues/42
```

### Parameters

- `GITHUB_URL` (required): Full GitHub issue URL

### Examples

```
/architect https://github.com/linnienaryshkin/inkwell/issues/42
/architect https://github.com/linnienaryshkin/inkwell/issues/15
```

## Workflow

### Phase 1: Issue Analysis
1. **Fetch Issue** — Retrieve issue title, description, and labels
2. **Identify Scope** — Determine feature type (UI, API, integration, etc.)
3. **Extract Requirements** — Parse explicit and implicit requirements

### Phase 2: Requirements Clarification
4. **Ask Questions** — Probe gaps and ambiguities in the spec
5. **Propose Alternatives** — Present 2-3 architectural approaches for key decisions
6. **User Selection** — Let user choose preferred approach (or customize)
7. **Document Decisions** — Lock in chosen direction

### Phase 3: Specification Writing
8. **Write Specs** — Generate elaborate technical specification covering:
   - **Overview** — What problem does this solve?
   - **Architecture** — System design and components involved
   - **Data Flow** — How data moves through the system
   - **API Design** — Endpoints, request/response schemas (if applicable)
   - **Database Schema** — Entity relationships and tables (if applicable)
   - **UI/UX Changes** — Component hierarchy, state management, styling (if applicable)
   - **Implementation Plan** — Step-by-step breakdown of work
   - **Testing Strategy** — Unit, integration, and e2e test coverage
   - **Edge Cases** — Known limitations and error scenarios
   - **Future Considerations** — Scalability, maintainability, evolution paths

### Phase 4: Issue Comment
9. **Post Specs** — Add finalized specification as GitHub issue comment
10. **Link Back** — Reference issue in the comment for traceability

## Clarification Questions

The skill will ask targeted questions based on issue type:

### For Feature Requests
- **Scope**: Is this a new feature, enhancement, or refactor?
- **Users**: Who benefits? What's the primary use case?
- **Constraints**: Timeline, dependencies, breaking changes?
- **Integration**: Does this touch other features? Need migrations?

### For Bug Fixes
- **Reproduction**: Can you provide steps to reproduce?
- **Root Cause**: Environment specific or affects all users?
- **Regression Risk**: What existing functionality could be affected?
- **Test Coverage**: Should we add tests to prevent recurrence?

### For Architecture/Infrastructure
- **Scale**: Expected growth, performance targets?
- **Availability**: Uptime requirements, graceful degradation?
- **Security**: Authentication, authorization, data sensitivity?
- **Monitoring**: Observability, alerting, debugging needs?

## Alternatives Presentation

For each major decision, present format:

```
Option A: [Name]
- Pros: [list]
- Cons: [list]
- Best for: [when to choose]

Option B: [Name]
- Pros: [list]
- Cons: [list]
- Best for: [when to choose]

Option C: [Name] (Recommended)
- Pros: [list]
- Cons: [list]
- Best for: [when to choose]
```

User selects one, or provides custom hybrid approach.

## Specification Template

```markdown
# Spec: [Issue Title]

## Overview
[1-2 paragraphs explaining the problem and solution]

## Architecture
[System design, components, interactions]

## Data Flow
[How data moves through the system - include diagram if complex]

## Implementation Plan
1. [First step]
2. [Second step]
3. ...

## Testing Strategy
- Unit tests: [coverage areas]
- Integration tests: [component interactions]
- E2E tests: [user journeys]

## Edge Cases & Error Handling
- [Case 1]: [How to handle]
- [Case 2]: [How to handle]

## Future Considerations
- [Scalability concern]
- [Maintenance note]
- [Evolution path]
```

## Quality Checklist

Before posting to issue, verify:

- ✓ All clarification questions answered
- ✓ Architectural decisions explicitly stated
- ✓ Implementation steps are actionable and sequenced
- ✓ Test coverage defined (≥90% target)
- ✓ Edge cases identified
- ✓ No ambiguity in requirements
- ✓ Feasible within stated constraints

## Critical Specification Details

To prevent implementation failures, ensure specs include:

### 1. **State Management Complexity**
- Specify how state flows between components and hooks
- Include diagrams or ASCII art for complex state transitions
- Call out where debouncing, throttling, or caching is needed
- Explicitly document: "when is state updated?" and "how often?"

**Example:**
```
User types → useHeadingExtraction parses (debounce 300ms)
  → update Heading[] → useScrollTracking monitors scroll
  → update currentHeadingId → TocTab highlights
```

### 2. **Third-Party Library Specifics**
- When integrating external libraries (Monaco, remark, marked), include specific API calls
- Note which APIs are hard to test in Jest (e.g., Monaco scroll events)
- Mention test environment gaps and workarounds
- Provide code snippets for complex integrations

**Example:**
```typescript
editor.revealLineInCenter(lineNumber, ScrollType.Smooth);
editor.onDidScrollChange((e) => {
  const topLine = editor.getVisibleRanges()[0]?.startLineNumber;
});
```

### 3. **Precise Acceptance Criteria**
- Replace vague terms with specific, testable behavior
- **Bad:** "Scroll works"
- **Good:** "Clicking TOC entry scrolls editor to heading, center heading in viewport, smooth animation"
- Include timeout expectations ("within 100ms", "debounce 300ms")
- Specify error states ("if heading not found, show toast", "if editor is null, disable TOC")

### 4. **Critical Integration Points**
- Call out where bugs are most likely (e.g., "scroll tracking is fragile because line numbers shift during edits")
- Document data validation boundaries (e.g., "line number must be validated before scroll")
- Mention race conditions or timing issues (e.g., "content changed while scrolling?")
- Include failure recovery strategies

**Example:**
```
CRITICAL: When user types, heading extraction re-runs and line numbers change.
If scroll tracking holds old line numbers, it will scroll to wrong location.
SOLUTION: Track heading by ID, not line number. Look up current line number
at scroll time using currentHeadingId.
```

### 5. **Hook/Component Wiring Diagram**
- For complex UIs with multiple hooks, include explicit data flow
- Show which component owns state vs. which hook transforms it
- Clarify prop drilling and callback chains
- Example:

```
StudioPage (owns editorRef, content)
  ↓ pass editorRef + content
  ↓
SidePanel
  ↓ pass content
  ↓
TocTab
  ├─ useHeadingExtraction(content) → Heading[]
  ├─ useScrollTracking(editorRef, Heading[]) → currentHeadingId
  ├─ useAnchorNavigation(editorRef) → navigate(id)
  └─ onClick → navigate(id) → editor scrolls
```

### 6. **Testing Gaps & Workarounds**
- Identify what's hard to test in the chosen test framework
- Suggest testing strategies for those parts (integration tests, manual testing, snapshot tests)
- Note coverage limitations (e.g., "Monaco APIs hard to mock, expect 85% branch coverage for TocTab")
- Provide mock implementations or test helpers

**Example:**
```
HARD TO TEST in Jest:
- Monaco editor scroll events (requires real editor instance)
- Line number accuracy after content changes

SOLUTION:
- Mock editor methods: revealLineInCenter, getVisibleRanges, onDidScrollChange
- Test core logic (heading extraction, ID generation) with 100% coverage
- Use integration/E2E tests for scroll behavior
```

### 7. **Performance Constraints**
- Specify where performance matters ("heading extraction must not block typing")
- Call out when optimization is premature vs. critical ("regex is fast enough for <10k lines")
- Mention thresholds ("if >500 headings, consider virtual scrolling")

### 8. **Explicit Error Handling**
- Don't just list edge cases; specify behavior
- **Bad:** "Handle empty documents"
- **Good:** "If content has no headings, show message 'No headings found' in TOC. Do not crash."

## Behavior

- **Interactive**: Asks questions and waits for answers before proceeding
- **Explores alternatives**: Presents multiple approaches with trade-offs
- **Documents decisions**: Records all design choices and rationale
- **GitHub-aware**: Reads issue metadata and posts results back
- **Plan mode compatible**: Works like Claude's EnterPlanMode—exploratory, then decisive
- **Fails gracefully**: If issue is invalid or inaccessible, reports clearly

## Common Specification Gaps (Lessons Learned)

These gaps appeared in real specs and caused implementation rework. Watch for them:

### 1. **Scroll-to-Element Functionality (Fragile)**
**What devs misunderstood:** Just mention the library API (e.g., "use Monaco's `revealLineInCenter()`")
**What was missing:**
- How to map TOC click → heading ID → current line number
- That line numbers shift when content changes
- How to handle "heading not found" errors
- Debouncing requirements to avoid lag

**Better spec includes:**
- Algorithm: "On click, lookup heading by ID → find its current line number → scroll → re-validate"
- Code snippet showing the pattern
- Error handling: "If heading not found (deleted by user), show toast 'Heading no longer exists'"
- "After each keystroke, heading extraction updates line numbers. Use ID-based lookups, not line numbers stored in state."

### 2. **Hook Composition Complexity**
**What devs misunderstood:** Spec lists hooks but not how they interact
**What was missing:**
- Which hook owns state? Which transforms it?
- Who calls whom? What are the props?
- Example: useScrollTracking needs both editorRef AND the Heading[] array to work

**Better spec includes:**
- Wiring diagram showing component → hook → Monaco API flow
- Clear prop/callback contracts for each hook
- "useScrollTracking watches scroll changes on editorRef. When scroll happens, find which heading's line number matches visible range, update currentHeadingId. Re-run on: scroll change + Heading[] array change (because line numbers shifted)"

### 3. **Testing Challenges Hidden**
**What devs misunderstood:** Spec says "100% test coverage" without noting library constraints
**What was missing:**
- Monaco APIs can't be fully mocked in Jest
- Scroll tracking accuracy is hard to test without real editor
- "Expected branch coverage 87.5%, not 100%, due to Jest limitations with Monaco"

**Better spec includes:**
- "Core logic (heading extraction) → test with 100% coverage"
- "Hook behavior (useScrollTracking) → test with mocks at 85% coverage"
- "Integration (click → scroll) → test manually or with E2E suite"
- Suggests test file structure: core logic separate from Monaco integration

### 4. **Acceptance Criteria Too Vague**
**What was accepted:** "Click-to-scroll works" ✓
**What actually broke:** "Scroll works" but goes to wrong location, no smooth animation, no error recovery

**Better spec replaces acceptance criteria like:**
- ❌ "Scroll works"
- ✓ "Clicking TOC entry scrolls editor: (1) center heading in viewport using `revealLineInCenter()`, (2) use smooth scroll animation, (3) if heading line not found, disable scroll silently and let user scroll manually"

### 5. **Real-Time Updates + Line Number Tracking**
**What devs built:** Heading extraction on every keystroke ✓, but line numbers cached ✗
**What was missing:**
- "Every heading extraction MUST re-calculate line numbers from scratch. Do not cache them."
- Race condition: "If useScrollTracking runs while Heading[] is updating, currentHeadingId may point to stale line number"
- Solution: "Use heading ID as primary key. Look up line number at scroll time, not at extraction time"

**Better spec includes:**
- "Line numbers are not stable. Always compute them fresh during parsing."
- "currentHeadingId (stored in state) is the source of truth, not line number"
- "On scroll: lookup currentHeadingId in Heading[] array, get its current lineNumber, validate it exists"

## Recommendations for Future Specs

1. **Always include code snippets** for complex integrations (even pseudocode)
2. **Always include error handling** in acceptance criteria (not just happy path)
3. **Always diagram state flow** for multi-hook/component features
4. **Always note testing gaps** upfront (saves debugging time later)
5. **Always use concrete examples** instead of abstractions
6. **Specify performance budgets** ("parsing must complete in <50ms")
7. **Specify update frequencies** ("debounce keystroke to 300ms", "scroll listener real-time OK")

## Limitations

- Requires valid GitHub issue URL
- User must have authentication context for private repos
- Complex specs may span multiple GitHub comments
- Cannot modify issue description (only add comments)