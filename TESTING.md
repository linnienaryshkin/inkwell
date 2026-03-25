# Testing Strategy

This project uses **Behavior-Driven Development (BDD)** testing with native Node.js test runner.

## Overview

- **Framework**: Node.js built-in `test` module (no external test framework)
- **Approach**: BDD scenario-focused tests from user perspective
- **Philosophy**: Minimal mocking, comprehensive behavior validation
- **File Location**: Tests co-located with components (`.test.js` files alongside components)

## Test Files

- [ArticleList.test.js](src/components/ArticleList.test.js) — Article list display and selection
- [EditorPane.test.js](src/components/EditorPane.test.js) — Content editing and preview modes

## Running Tests

```bash
# Run tests once
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Run with coverage (when available)
npm run test:coverage
```

## Test Structure

Tests are organized by user scenarios using `describe()` and `test()`:

```javascript
describe("Feature Name", () => {
  describe("User performs action", () => {
    test("should result in expected behavior", () => {
      // Scenario description
      // Test implementation
    });
  });
});
```

## BDD Principles Applied

1. **User-Focused**: Tests describe what users see and do, not implementation details
2. **Minimal Mocking**: Tests focus on actual behavior, not mocked implementations
3. **Scenario-Based**: Each test represents a real user scenario
4. **Clear Intent**: Comments explain "Scenario" and "Expected" outcomes

## Adding New Tests

1. Create `.test.js` file next to the component
2. Use `describe()` for grouping related scenarios
3. Write tests from user perspective
4. Include "Scenario:" and "Expected:" comments

Example:

```javascript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("ComponentName", () => {
  describe("User does something", () => {
    test("should have expected result", () => {
      // Scenario: User clicks button
      // Expected: Modal opens

      // Test implementation
      assert.ok(modalIsOpen);
    });
  });
});
```

## Future Enhancements

- Integration with Vitest for advanced coverage tracking
- E2E tests for user workflows
- Performance benchmarking
