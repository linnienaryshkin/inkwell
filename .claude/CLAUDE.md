# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Inkwell

Inkwell is a browser-based markdown writing studio for developer-writers where a GitHub repository serves as the CMS. Write in Monaco editor, every save becomes a GitHub commit, lint inline, publish to platforms (dev.to, Hashnode, etc.), and track which commit SHA was published where via `publish-log.json`.

## Commands

- `npm run dev` — start Next.js dev server
- `npm run build` — production build (ESLint and TypeScript errors are ignored via next.config.ts)
- `npm run start` — serve production build

No test framework or linter is configured yet.

## Architecture

Next.js 15 App Router, single-page client app. All UI state lives in `src/app/studio/page.tsx` (the `"use client"` page), which is the main entry point — `/` redirects to `/studio`.

### Current state (MVP)

The app is a **static UI prototype with mock data**. There is no GitHub API integration, no auth, no API routes yet. Articles, versions, and lint results are all hardcoded mocks in their respective components.

### Layout structure

The studio page uses a three-panel layout:
- **Left**: `ArticleList` — selectable article sidebar
- **Center**: `EditorPane` (Monaco via `@monaco-editor/react`, dynamically imported with SSR disabled) + `VersionStrip` below
- **Right**: `SidePanel` — tabs between Lint and Publish views

### Shared types

The `Article` type is defined and exported from `src/app/studio/page.tsx`. Components import it from there.

### Styling

Dark theme using CSS custom properties defined in `globals.css` (GitHub-dark-inspired palette). Components use Tailwind CSS v4 utilities combined with inline `style` props referencing CSS variables (e.g., `style={{ color: "var(--text-secondary)" }}`). This pattern is used consistently throughout — follow it when adding new UI.

### Path aliases

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Planned architecture (not yet implemented)

Per README.md, the intended design includes:
- **Auth**: NextAuth.js v5 + GitHub OAuth
- **GitHub I/O**: Octokit.js for all repo operations (articles stored as `articles/{slug}/content.md` + `meta.json` + `publish-log.json`)
- **API routes**: `/api/articles`, `/api/articles/[slug]`, versions, lint, publish
- **Branching**: `drafts/` branch for auto-saves, `main` for checkpointed versions
- **Linting**: write-good + alex + Flesch-Kincaid (server-side)
- **Deploy**: Vercel
