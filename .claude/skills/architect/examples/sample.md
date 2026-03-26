# Spec: Word Count & Reading Time in Editor Toolbar

> **Issue**: #14 — Show word count and estimated reading time while writing
> **Label**: `refined`

---

## Overview

Writers need a quick sense of article length without leaving the editor. This feature adds a live word count and reading-time estimate to the `EditorPane` toolbar, updating as the user types. No new network calls are required — all computation is client-side.

**Before state** (screenshot taken at spec time):

![Studio before](./screenshots/editor-before.png)

<!-- playwright-mcp screenshot of http://localhost:3000/studio, taken with get-screenshot -->

---

## Architecture

### State ownership

`StudioPage` already owns `content` (updated via `handleContentChange`). Stats are pure derivations of content — no new state is needed in `StudioPage`. Computation lives in a custom hook inside `EditorPane`.

```
StudioPage (owns article.content)
  → EditorPane (receives content via article.content)
      ├─ useReadingStats(content) → { words: number; minutes: number }
      └─ EditorToolbar (receives stats, renders pill badges)
```

### Option A: Inline computation in EditorPane

Compute stats directly inside `EditorPane` without a separate hook.

- **Pros**: Fewer files, simpler for a small calculation
- **Cons**: Mixes concerns; harder to test stats logic in isolation; can't reuse in `SidePanel` later

### Option B: `useReadingStats` custom hook (Recommended)

Extract stats into a hook that accepts `content: string` and returns `{ words, minutes }`.

- **Pros**: Isolated, unit-testable without rendering Monaco; reusable in `SidePanel` lint view; debounced internally
- **Cons**: One more file

**Decision**: Option B.

---

## Data Flow

```
article.content (string)
  → useReadingStats(content, { debounceMs: 300 })
      ├─ word count  = content.trim().split(/\s+/).filter(Boolean).length
      └─ reading time = Math.max(1, Math.ceil(words / 200))   // 200 wpm average
  → EditorToolbar props { words, minutes }
  → rendered as "342 words · 2 min read"
```

Empty document (`""` or whitespace-only): both values are `0`; render `"0 words · < 1 min"`.

---

## API Design

No API routes involved. The hook signature:

```typescript
// src/hooks/useReadingStats.ts
export function useReadingStats(
  content: string,
  options?: { debounceMs?: number }
): { words: number; minutes: number };
```

Default `debounceMs`: `300`.

---

## UI/UX Changes

### Component hierarchy

```
EditorPane
  └─ EditorToolbar (new sub-component, or inline section in EditorPane)
       └─ stat pills: "342 words · 2 min read"
```

### Placement

Append stats to the right side of the existing toolbar row in `EditorPane`, next to the zen-mode toggle. Use the same `var(--text-secondary)` color and `text-xs` size as surrounding toolbar items.

```
[Zen toggle]  [theme toggle]        [342 words · 2 min read]
```

Stats are non-interactive (no click). No tooltip needed for MVP.

### Styling (follows existing pattern)

```tsx
<span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
  {words} {words === 1 ? "word" : "words"} · {minutes < 1 ? "< 1" : minutes} min read
</span>
```

---

## Implementation Plan

1. **Create `src/hooks/useReadingStats.ts`** — implement word count, reading-time, and debounce logic. Export `useReadingStats`.

2. **Create `src/hooks/useReadingStats.test.ts`** — unit-test: empty string, single word, multi-word, whitespace-only, debounce behavior (use `jest.useFakeTimers`).

3. **Update `EditorPane.tsx`** — call `useReadingStats(article.content)` and render the stats pill in the toolbar row.

4. **Update `EditorPane.test.tsx`** — add rendering tests for the stats pill.

5. **Run `npm run lint && npm run types:check && npm test:coverage`** — verify no regressions.

---

## Testing Strategy

### Unit tests — `useReadingStats.test.ts`

| Scenario        | Input                               | Expected                       |
| --------------- | ----------------------------------- | ------------------------------ |
| Empty string    | `""`                                | `{ words: 0, minutes: 0 }`     |
| Single word     | `"Hello"`                           | `{ words: 1, minutes: 1 }`     |
| 200 words       | 200-word string                     | `{ words: 200, minutes: 1 }`   |
| 201 words       | 201-word string                     | `{ words: 201, minutes: 2 }`   |
| Whitespace only | `"   \n  "`                         | `{ words: 0, minutes: 0 }`     |
| Debounce        | type fast, check before/after 300ms | value only updates after delay |

Use `renderHook` from `@testing-library/react` + `jest.useFakeTimers()` for debounce.

### Component tests — `EditorPane.test.tsx`

- Stats pill renders with initial article content (mock Monaco, check DOM text like `/\d+ words/`).
- Stats update after `onChange` fires new content (simulate with `act`).

### What can't be tested in Jest

Monaco's actual editor events can't fire in jsdom. Tests must bypass Monaco by calling `onChange` directly (existing mock pattern in `EditorPane.test.tsx` already does this).

**Coverage expectation**: `useReadingStats` should reach 100% line/branch coverage. `EditorPane` additions add ~5 lines; maintain ≥90% overall.

---

## Edge Cases & Error Handling

| Case                            | Behavior                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Empty document                  | Show `"0 words · < 1 min"` — never show `NaN` or blank                                                              |
| Very large article (50k words)  | Debounce prevents per-keystroke recompute; regex split is O(n), acceptable                                          |
| Non-Latin scripts (CJK, Arabic) | `\s+` split undercounts; acceptable for MVP — note in code comment                                                  |
| `content` is `undefined`        | Hook treats as `""` via `content ?? ""`; no throw                                                                   |
| Zen mode active                 | Stats are inside `EditorPane`'s toolbar which remains visible in zen mode (only `ArticleList` and `SidePanel` hide) |

---

## Future Considerations

- **Per-platform targets**: dev.to recommends 1,000–3,000 words; surface a soft warning in `SidePanel` lint tab when out of range.
- **Reuse in SidePanel**: `useReadingStats` is already extracted, so `SidePanel` lint view can import and display stats without duplication.
- **CJK word counting**: Switch to a unicode-aware tokenizer (e.g., `intl-segmenter`) if multi-language support is added.
- **Performance**: At 50k words, `split(/\s+/)` runs in ~2ms. No Web Worker needed unless articles exceed ~200k words.
