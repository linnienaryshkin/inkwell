# Inkwell

A browser-based markdown writing studio for developer-writers, backed by GitHub.

## Summary

Inkwell puts Monaco editor at the center of your writing workflow. Every save becomes a GitHub commit, articles are stored directly in your repository, and the app tracks where and when each version was published — making your GitHub repo the CMS.

## Objective

Give developer-writers a distraction-free, code-quality writing environment that feels like an IDE: syntax highlighting, inline linting, version history from Git, and one-click publishing to platforms like dev.to and Hashnode — all without leaving the browser.

## Plans

### Now (MVP — UI prototype)

- Three-panel studio layout (article list / Monaco editor / lint + publish sidebar)
- Live markdown preview with GFM support
- Zen mode, word count, reading time
- Auto-generated table of contents from headings
- Version timeline strip (UI only, mock data)
- Inline lint results panel (UI only, mock data)
- Publish controls panel (UI only, mock data)

### Next (backend integration)

- **Auth** — NextAuth.js v5 + GitHub OAuth
- **Storage** — Octokit.js; articles stored as `articles/{slug}/content.md` + `meta.json` + `publish-log.json`
- **API routes** — `/api/articles`, `/api/articles/[slug]`, versions, lint, publish
- **Branching** — `drafts/` branch for auto-saves, `main` for published checkpoints
- **Linting** — write-good + alex + Flesch-Kincaid (server-side)
- **Publishing** — dev.to and Hashnode API integrations
- **Publish log** — track commit SHA, platform, and timestamp per published version

## Development

### Architecture

Next.js 15 App Router, single-page client app. All UI state lives in `src/app/studio/page.tsx`, which renders the three-panel layout:

| Panel  | Component                     | Role                                                      |
| ------ | ----------------------------- | --------------------------------------------------------- |
| Left   | `ArticleList`                 | Article sidebar with draft/published status               |
| Center | `EditorPane` + `VersionStrip` | Monaco editor, preview toggle, zen mode, version timeline |
| Right  | `SidePanel`                   | Tabbed lint results, publish controls, table of contents  |

**Tech stack**

- Framework: Next.js 15 (App Router)
- Editor: Monaco Editor (`@monaco-editor/react`)
- Styling: Tailwind CSS v4 + CSS custom properties (GitHub Dark theme)
- Testing: Jest + Testing Library (90% coverage threshold)
- Deployment: Vercel (intended)

**Styling pattern** — components use Tailwind utilities combined with inline `style` props referencing CSS variables:

```tsx
<div style={{ color: "var(--text-secondary)" }}>Content</div>
```

**File structure**

```
src/
├── app/
│   ├── globals.css              # CSS custom properties (GitHub Dark theme)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Redirects / → /studio
│   └── studio/
│       └── page.tsx             # Main "use client" entry; Article type lives here
└── components/
    ├── ArticleList.tsx           # Left panel
    ├── EditorPane.tsx            # Center panel (Monaco, preview, zen mode)
    ├── SidePanel.tsx             # Right panel (lint / publish / TOC tabs)
    ├── TocTab.tsx                # Table of contents
    └── VersionStrip.tsx          # Version timeline
```

### Installation

**Prerequisites**

| Tool                                  | Version | Purpose                                   |
| ------------------------------------- | ------- | ----------------------------------------- |
| [Node.js](https://nodejs.org)         | 18+     | Runtime and package manager               |
| [gh](https://cli.github.com)          | latest  | GitHub CLI — used in the SDD workflow     |
| [Claude Code](https://claude.ai/code) | latest  | AI-assisted spec and development workflow |

**Install dependencies**

```bash
npm install
```

### Launch

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # production build
npm run start      # serve production build
```

**Quality checks** (run before committing)

```bash
npm run lint:check      # ESLint strict (zero warnings)
npm run format:check    # Prettier check
npm run types:check     # TypeScript — no emit
npm test:coverage       # Jest with 90% coverage threshold
```

Auto-fix shortcuts:

```bash
npm run lint       # ESLint auto-fix
npm run format     # Prettier auto-format
```

> ESLint and TypeScript errors are intentionally ignored during `next build` to allow the prototype to ship. Fix errors where possible; add an explanatory comment when skipping is necessary.

## SDD

Inkwell uses a spec-driven development flow powered by Claude Code and GitHub Issues.

1. **Architect** — Run `/architect <github-issue-url>` locally to generate a technical spec from the issue. The skill reads the issue, explores the codebase, and writes a detailed implementation plan as a comment.
2. **Implement** — Comment on the issue with `@claude develop task`. Claude Code picks up the spec and opens a PR.
3. **Review** — Inspect the PR. Add review comments if changes are needed; Claude iterates.
4. **Merge** — Merge when satisfied.

This keeps design decisions traceable to issues and implementation traceable to specs.
