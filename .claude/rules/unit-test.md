---
description: Apply when writing or reviewing tests for any part of the codebase (UI components or API endpoints).
paths:
  - "ui/src/**/*.test.{ts,tsx}"
  - "ui/src/**/*.spec.{ts,tsx}"
  - "api/tests/**/*.py"
---

# Testing Rules

Both the UI (Jest/React Testing Library) and API (pytest) follow the same conventions: BDD style, 90% coverage, test behavior not internals.

## BDD Approach

Write tests from the **user's/caller's perspective**, not implementation details:

- ✅ Test visible behavior and user interactions (UI) or HTTP contract and side effects (API)
- ✅ Test success cases, error cases, and edge cases
- ❌ Do NOT test internal state, props, or implementation details

## Test Structure

Use `describe()` / `it()` (UI) or class/function grouping (API):

**UI (TypeScript):**

```typescript
describe("ComponentName", () => {
  describe("Display", () => {
    it("should render expected content", () => { /* ... */ });
  });

  describe("User interaction", () => {
    it("should update when clicked", () => { /* ... */ });
  });
});
```

**API (Python):**

```python
class TestArticlesEndpoint:
    def test_returns_all_articles(self, client):
        response = client.get("/articles")
        assert response.status_code == 200

    def test_returns_404_for_unknown_slug(self, client):
        response = client.get("/articles/does-not-exist")
        assert response.status_code == 404
```

## Test File Location

- **UI:** colocated with the source file as `FileName.test.{ts,tsx}` (e.g., `EditorPane.test.tsx` next to `EditorPane.tsx`, `useHeadingExtraction.test.ts` next to `useHeadingExtraction.ts`)
- **API:** in `api/tests/` directory (e.g., `tests/test_articles.py`)

## Query Priority — UI

When finding DOM elements:

1. `getByRole()` — most accessible, mimics user navigation
2. `getByLabelText()` — for form fields
3. `getByText()` — for text content
4. `data-testid` — only when others won't work

```typescript
const button = screen.getByRole("button", { name: /submit/i });
fireEvent.click(button);
expect(screen.getByText("Success")).toBeInTheDocument();
```

## Mocking

- **UI:** mock only external libraries (Monaco Editor, React Markdown, third-party APIs); never mock internal components or utilities
- **API:** use `pytest` fixtures and FastAPI `TestClient`; mock only external I/O (databases, third-party HTTP calls)

## Coverage & Quality

90% coverage on lines, functions, branches, and statements — enforced in CI for both packages.

- **UI:** `npm run test:coverage` (from `ui/`)
- **API:** `uv run pytest tests/ -v` (from `api/`)
