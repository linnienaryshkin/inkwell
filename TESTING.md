# Testing Strategy

This project uses **Jest** with **React Testing Library** for component testing, following BDD principles.

## Overview

- **Framework**: Jest (with Next.js integration)
- **Component Testing**: React Testing Library for testing components from a user's perspective
- **Approach**: BDD scenario-focused tests focused on user interactions and visible behavior
- **Philosophy**: Test actual component rendering and user interactions, not implementation details
- **File Location**: Tests co-located with components (`.test.tsx` files alongside components)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm test -- --watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test ArticleList.test.tsx

# Run with verbose output
npm test -- --verbose
```

## Test Structure

Tests are organized by feature and user scenarios using `describe()` and `it()` (Jest syntax):

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { Component } from "./Component";

describe("Component", () => {
  describe("User interaction", () => {
    it("should display expected content", () => {
      render(<Component />);

      expect(screen.getByText("Expected text")).toBeInTheDocument();
    });

    it("should handle user action", () => {
      render(<Component />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByText("Updated content")).toBeInTheDocument();
    });
  });
});
```

## BDD Principles Applied

1. **User-Focused**: Tests describe what users see and do, not implementation details
   - Use `screen` queries (e.g., `getByText`, `getByRole`) to find elements like a user would
   - Test visible behavior, not component props or state

2. **Component Integration**: Tests render actual React components
   - Components are tested together with their dependencies (except complex 3rd-party libraries)
   - Mocks used only for external libraries (Monaco Editor, React Markdown) to focus on component behavior

3. **Interaction Testing**: Tests simulate real user actions
   - Use `fireEvent` for clicks, input changes, etc.
   - Verify outcomes from the user's perspective

4. **Readable Tests**: Test names clearly describe what is being tested
   - Use `it("should...")` pattern for clarity
   - Organize with logical `describe()` blocks

## Adding New Tests

1. Create `.test.tsx` file next to the component
2. Import `render`, `screen`, and `fireEvent` from `@testing-library/react`
3. Render the component and test user interactions
4. Use `screen` queries and `fireEvent` for user-like interactions
5. Assert on what the user sees in the DOM

Example:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  describe("Display", () => {
    it("should render content", () => {
      render(<MyComponent title="Test" />);

      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });

  describe("Interaction", () => {
    it("should update on click", () => {
      render(<MyComponent />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByText("Updated")).toBeInTheDocument();
    });
  });
});
```

### Best Practices

- **Query Priority**: Prefer `getByRole`, `getByLabelText`, then `getByText` (in that order)
- **Avoid Testing Implementation**: Don't assert on props or internal state
- **Test User Workflows**: Write tests that simulate real user interactions
- **Use Data Attributes**: Use `data-testid` only when other queries won't work

## Coverage Requirements

Current coverage thresholds (enforced in jest.config.ts):

- Lines: 90%
- Functions: 90%
- Branches: 90%
- Statements: 90%

View coverage report:

```bash
npm run test:coverage
# HTML report: open coverage/index.html
```

## Tips for Effective Testing

### What to Test

- ✅ Component renders with expected content
- ✅ User interactions trigger callbacks
- ✅ State changes update the UI
- ✅ Props affect component behavior
- ✅ Conditional rendering works correctly

### What NOT to Test

- ❌ Implementation details (internal state, methods)
- ❌ Third-party library behavior (assume it works)
- ❌ CSS styling (test with data-testid if critical)
- ❌ Simple prop passing without side effects

## Debugging Tests

```bash
# Run single test file
npm test ArticleList.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should display"

# Debug in interactive mode
node --inspect-brk ./node_modules/jest/bin/jest.js --runInBand
```

## Future Enhancements

- E2E tests with Playwright/Cypress for full user workflows
- Visual regression testing for UI consistency
- Performance benchmarking for component rendering
- API integration tests (when GitHub API is integrated)
