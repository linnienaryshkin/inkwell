# Inkwell — Personal Writing Studio backed by GitHub

A browser-based markdown writing studio for developer-writers. Write, edit, and publish technical content in a streamlined Monaco editor environment while your GitHub repository serves as your content management system.

## Features

- **Monaco Editor Integration** — Syntax highlighting, IntelliSense, and a familiar coding environment for markdown
- **Git-backed Storage** — Every save becomes a GitHub commit; no separate database needed
- **Multi-version Tracking** — Checkpoint versions and view edit history
- **Inline Linting** — Real-time writing quality feedback (linting rules: write-good, alex, Flesch-Kincaid)
- **Multi-platform Publishing** — Publish to dev.to, Hashnode, and other platforms
- **Publish Log** — Track which commit SHA was published where and when
- **Zen Mode** — Full-screen distraction-free writing
- **Markdown Preview** — Toggle between editing and preview modes

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A GitHub account (for future auth and API integration)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens the dev server at `http://localhost:3000`. The app redirects `/` to `/studio` where the main editor interface lives.

### Production Build

```bash
npm run build
npm run start
```

## Architecture

### Current State (MVP)

The app is a **static UI prototype** with hardcoded mock data. The three-panel layout includes:

- **Left Panel**: Article list (selectable sidebar)
- **Center Panel**: Monaco editor for markdown + version timeline below
- **Right Panel**: Lint results and publish controls (tabbed)

All articles, versions, and lint results are currently mocked—no real GitHub integration or authentication yet.

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Styling**: Tailwind CSS v4 + CSS custom properties (GitHub Dark theme)
- **Deployment**: Vercel (intended)

### File Structure

```
src/
├── app/
│   ├── studio/
│   │   └── page.tsx          # Main "use client" page; renders the three-panel UI
│   └── layout.tsx             # Root layout
└── components/
    ├── ArticleList.tsx        # Left panel
    ├── EditorPane.tsx         # Center panel (Monaco editor)
    ├── VersionStrip.tsx       # Version timeline
    ├── SidePanel.tsx          # Right panel (tabs)
    ├── LintView.tsx           # Lint results
    └── PublishView.tsx        # Publish controls
```

### Styling Pattern

All components use Tailwind CSS combined with inline `style` props that reference CSS variables from `globals.css`:

```tsx
<div style={{ color: "var(--text-secondary)" }}>Content</div>
```

### Shared Types

The `Article` type is defined in `src/app/studio/page.tsx` and imported by other components.

## Planned Features (Roadmap)

These are not yet implemented:

- **Authentication**: NextAuth.js v5 + GitHub OAuth
- **GitHub API Integration**: Octokit.js for all repository operations
- **Storage Structure**: Articles stored as `articles/{slug}/content.md` + `meta.json` + `publish-log.json`
- **API Routes**: `/api/articles`, `/api/articles/[slug]`, versions, lint, publish
- **Branching Strategy**: `drafts/` branch for auto-saves, `main` for checkpointed versions
- **Server-side Linting**: write-good, alex, Flesch-Kincaid analysis
- **Publish Integrations**: dev.to, Hashnode, and other platform APIs

## Development Notes

- No test framework or linter is currently configured
- TypeScript and ESLint errors are intentionally ignored in production builds (configured in `next.config.ts`)
- The entire app lives in a single "use client" component for simplicity during prototyping

## License

MIT
