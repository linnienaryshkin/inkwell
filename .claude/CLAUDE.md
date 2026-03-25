# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Inkwell

Inkwell is a browser-based markdown writing studio for developer-writers where a GitHub repository serves as the CMS. Write in Monaco editor, every save becomes a GitHub commit, lint inline, publish to platforms (dev.to, Hashnode, etc.), and track which commit SHA was published where via `publish-log.json`.

## Commands

### Development & Build

- `npm run dev` — start Next.js dev server at `http://localhost:3000`
- `npm run build` — production build (ESLint and TypeScript errors are ignored via next.config.ts)
- `npm run start` — serve production build

### Testing

- `npm test` — run Jest test suite (`.test.tsx` or `.spec.tsx` files)
- `npm test -- ArticleList` — run tests matching a pattern (useful for single component testing)
- `npm run test:coverage` — run tests with coverage report (enforces 90% global threshold)

### Linting & Formatting

- `npm run lint` — auto-fix ESLint issues
- `npm run lint:check` — run ESLint with strict mode (fails on any warnings)
- `npm run format` — format code with Prettier
- `npm run format:check` — check Prettier formatting without modifying files
- `npm run types:check` — check TypeScript types without emitting files

## Architecture

Next.js 15 App Router, single-page client app. All UI state lives in `src/app/studio/page.tsx` (the `"use client"` page), which is the main entry point — `/` redirects to `/studio`.

### Current state (MVP)

The app is a **static UI prototype with mock data**. There is no GitHub API integration, no auth, no API routes yet. Articles, versions, and lint results are all hardcoded mocks in their respective components.

### Layout structure

The studio page uses a three-panel layout:

- **Left**: `ArticleList` — selectable article sidebar
- **Center**: `EditorPane` (Monaco via `@monaco-editor/react`, dynamically imported with SSR disabled) + `VersionStrip` below
- **Right**: `SidePanel` — tabbed interface with Lint results and Publish controls (both views implemented within SidePanel.tsx)

### Shared types

The `Article` type is defined and exported from `src/app/studio/page.tsx`. Components import it from there.

### Styling

Dark theme using CSS custom properties defined in `globals.css` (GitHub-dark-inspired palette). Components use Tailwind CSS v4 utilities combined with inline `style` props referencing CSS variables (e.g., `style={{ color: "var(--text-secondary)" }}`). This pattern is used consistently throughout — follow it when adding new UI.

### Path aliases

`@/*` maps to `./src/*` (configured in tsconfig.json). Jest also supports this alias via moduleNameMapper.

## Code Quality

**Build behavior**: ESLint and TypeScript errors are intentionally ignored during production builds (configured in `next.config.ts`). Additionally, TypeScript strict mode is disabled in `tsconfig.json` to allow rapid prototyping. This allows the prototype to ship even with type/lint issues. However:

- Always run `npm run lint:check`, `npm run format:check`, and `npm run types:check` locally before committing
- Run `npm test:coverage` to ensure coverage thresholds are met
- Fix errors where possible; if skipping is necessary, add an explanatory comment
- Use `npm run lint` (without `:check`) to auto-fix linting issues during development

## File Structure

```
.
├── jest.config.ts                # Jest configuration (coverage: 90% threshold)
├── jest.setup.ts                 # Jest setup (imports testing-library/jest-dom)
└── src/
    ├── app/
    │   ├── globals.css           # CSS custom properties (GitHub Dark theme)
    │   ├── layout.tsx            # Root layout
    │   ├── page.tsx              # Redirect to /studio
    │   └── studio/
    │       └── page.tsx          # Main "use client" entry point; renders 3-panel UI
    └── components/
        ├── ArticleList.tsx       # Left panel (article sidebar)
        ├── ArticleList.test.tsx
        ├── EditorPane.tsx        # Center panel (Monaco editor)
        ├── EditorPane.test.tsx
        ├── SidePanel.tsx         # Right panel (Lint/Publish tabs)
        ├── SidePanel.test.tsx
        ├── VersionStrip.tsx      # Version timeline (below editor)
        └── VersionStrip.test.tsx
```

## Planned architecture (not yet implemented)

Per README.md, the intended design includes:

- **Auth**: NextAuth.js v5 + GitHub OAuth
- **GitHub I/O**: Octokit.js for all repo operations (articles stored as `articles/{slug}/content.md` + `meta.json` + `publish-log.json`)
- **API routes**: `/api/articles`, `/api/articles/[slug]`, versions, lint, publish
- **Branching**: `drafts/` branch for auto-saves, `main` for checkpointed versions
- **Linting**: write-good + alex + Flesch-Kincaid (server-side)
- **Deploy**: Vercel
