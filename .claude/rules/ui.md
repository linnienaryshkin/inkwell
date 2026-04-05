---
description: UI components, state management, styling, and tests for this repository.
paths:
  - "ui/**"
---

## State Management

- Global layout state (zenMode, theme) lives in `studio/page.tsx` — pass down as props/callbacks
- Each component manages only its own local UI state (tabs, toggles, etc.)

## Styling Rules

- Dark theme via CSS custom properties in `globals.css`
- Use Tailwind utilities + inline `style` props with CSS variables: `style={{ color: "var(--text-secondary)" }}`
- Buttons: use fixed dimensions with flex centering to prevent layout shift on toggle:
  ```tsx
  style={{ width: "32px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}
  ```

## Tests

- When UI text changes, update queries to `getByTitle()`, `getByRole()`, or `getByTestId()` — never rely on icon/emoji text
- Add tests immediately for new features; verify ≥90% branch coverage

## Implementation Checklist

- [ ] Identify where state lives (parent vs. child)
- [ ] Define props and callbacks needed
- [ ] Implement UI in the correct component
- [ ] Wire click handlers to state
- [ ] Verify in browser via playwright-mcp (`http://localhost:3000/studio`) — take a screenshot, test 2+ state transitions, take a final screenshot
- [ ] If working on a GitHub issue, post the final screenshot(s) as a comment on the issue
- [ ] Update tests; run `npm run test:coverage`
- [ ] Run `npm run lint:check` and `npm run format:check`

## Common Pitfalls

- Button resizes on toggle → use fixed dimensions
- Tests break after text changes → update query strategy
- State duplicated across components → pass props instead
- Skipping browser verification → always test 2+ transitions
