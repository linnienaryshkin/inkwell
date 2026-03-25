---
name: ui-engineer
description: Changes affect visual layout, component structure, user interactions, or styling
---

# UI Engineer Skill

Best practices and workflow for implementing UI/UX changes in Inkwell.

## Core Principles

### 1. Component Hierarchy & State

- Place global layout state (zenMode, theme) at the top-level parent (`studio/page.tsx`)
- Pass state and callbacks as props to child components that need them
- Each component manages only its own local UI state (preview toggle, tabs, etc.)
- Use callback pattern: `onToggleZen()` instead of duplicating state

### 2. Button Sizing Consistency

Use fixed dimensions with flex centering to prevent layout shift:

```tsx
style={{
  width: "32px",
  height: "24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}}
```

This ensures buttons don't resize when toggling or when text changes.

### 3. Test Updates

When UI text changes (e.g., "Preview" → "👁"):

- Update test queries to use `getByTitle()`, `getByRole()`, or `getByTestId()`
- Never rely on icon/emoji text for button queries
- Add tests immediately for new features (don't defer)
- Verify test coverage meets 90% threshold

### 4. Browser Verification Steps

1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:3000/studio`
3. Test each user interaction (click buttons, toggle states)
4. Verify visual alignment and spacing
5. Check active/inactive state styling
6. Test at least 2 state transitions
7. Verify no layout shift occurs

### 5. Feature Implementation Checklist

- [ ] **Understand requirement**: UI change, layout shift, new button/control?
- [ ] **Identify state location**: Parent vs child component?
- [ ] **Define props**: What data/callbacks needed?
- [ ] **Implement UI**: Add elements to correct component
- [ ] **Wire handlers**: Connect clicks to state management
- [ ] **Test in browser**: Visual verification (2+ transitions)
- [ ] **Update tests**: Query changes, new test cases
- [ ] **Verify coverage**: `npm run test:coverage` (≥90%)
- [ ] **Lint/format**: `npm run lint:check`, `npm run format:check`
- [ ] **Commit**: Clear message explaining changes

## Recent Learnings (Issue #63)

### Problem

- Editor menu button changed size when toggling modes (layout shift)
- Missing separate expand button
- Zen mode button disconnected from layout functionality

### Solution Applied

1. **Fixed button sizing**: 32x24px with flex centering → no shift
2. **Moved button to toolbar**: From overlay to menu bar for better UX
3. **Integrated state management**: Passed zenMode/onToggleZen props from parent
4. **Updated all tests**: Changed queries from text to title-based lookups
5. **Verified in browser**: Confirmed visual behavior and state transitions

### Key Outcomes

- ✅ Buttons maintain consistent size when toggling
- ✅ Expand button hides header, article list, side panel
- ✅ All tests passing (93 tests, 95%+ coverage)
- ✅ Clean, integrated UI with no layout jank

## File Organization

- `studio/page.tsx` — Global layout state (zenMode, theme)
- `EditorPane.tsx` — Editor controls (preview, expand buttons)
- `ArticleList.tsx` — Left sidebar content
- `SidePanel.tsx` — Right sidebar (Lint/Publish)
- `VersionStrip.tsx` — Version timeline

## Common Pitfalls

❌ Button sizing changes → Use fixed dimensions
❌ Tests fail on UI text changes → Update queries appropriately
❌ State duplication → Pass props instead
❌ Skip browser testing → Always verify 2+ transitions
❌ Defer test updates → Add tests immediately
❌ Absolute positioning → Integrate into logical menu structure
❌ Missing active states → Show which controls are enabled
