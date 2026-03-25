---
paths:
  - "src/components/**/*.{ts,tsx}"
---

# Component Testing Rules

## Test Files

- Create `.test.tsx` files colocated with components (e.g., `EditorPane.test.tsx` next to `EditorPane.tsx`)
- Test files are automatically picked up by Jest during `npm test`
- Each component must maintain 90% coverage threshold globally (lines, functions, branches, statements)

## BDD Testing Approach

Write tests from the **user's perspective**, not implementation details:

- ✅ Test visible behavior and user interactions
- ✅ Test component renders with expected content
- ✅ Test that user actions trigger expected outcomes
- ❌ Do NOT test internal state, component props, or implementation details

## Test Structure

Use `describe()` blocks for feature grouping and `it()` for specific scenarios:

```typescript
describe("ComponentName", () => {
  describe("Display", () => {
    it("should render expected content", () => {
      /* ... */
    });
  });

  describe("User interaction", () => {
    it("should update when clicked", () => {
      /* ... */
    });
  });
});
```

## Query Priority (in order of preference)

When finding DOM elements, use:

1. `getByRole()` — most accessible, mimics user navigation
2. `getByLabelText()` — for form fields
3. `getByText()` — for text content
4. `data-testid` — only when others won't work

Example:

```typescript
const button = screen.getByRole("button", { name: /submit/i });
fireEvent.click(button);
expect(screen.getByText("Success")).toBeInTheDocument();
```

## Mocking

- Mock **only external libraries**: Monaco Editor, React Markdown, third-party APIs
- **Never mock** internal components or utility functions — render actual dependencies
- This keeps tests focused on real component behavior

## Coverage & Quality

- Run `npm test` before committing to verify 90% coverage threshold
- Run `npm run test:coverage` to view detailed coverage reports

## Key Patterns

- Use `render()` to mount components
- Use `fireEvent` for clicks, input changes, form submissions
- Use `screen` queries to find elements (not `getByTestId` unless necessary)
- Assert on what users see in the DOM, not component internals
