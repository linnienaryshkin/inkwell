# Getting Started with TypeScript

TypeScript adds static type checking to JavaScript, catching errors before they reach production.

## Why TypeScript?

- **Catch bugs early** — type errors surface at compile time, not runtime
- **Better IDE support** — autocomplete, refactoring, and inline docs
- **Self-documenting** — types serve as living documentation

## Quick Setup

```bash
npm init -y
npm install typescript --save-dev
npx tsc --init
```

## Your First Type

```typescript
interface Article {
  title: string;
  slug: string;
  tags: string[];
  publishedAt?: Date;
}

function formatArticle(article: Article): string {
  return `# ${article.title}\nTags: ${article.tags.join(", ")}`;
}
```

Types make your intent explicit. Your future self will thank you.
