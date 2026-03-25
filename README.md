# [Inkwell — Personal Writing Studio backed by GitHub](https://github.com/linnienaryshkin/inkwell)

A browser-based markdown writing studio for developer-writers. Write, edit, and publish technical content in a streamlined Monaco editor environment while your GitHub repository serves as your content management system.

## Features

### Implemented
- **Monaco Editor Integration** — Syntax highlighting, IntelliSense, and a familiar coding environment for markdown
- **Live Markdown Preview** — Split-pane editor with toggle between editing and preview modes
- **Zen Mode** — Full-screen distraction-free writing with expand button
- **Word Count & Reading Time** — Status bar displays word count and estimated reading time
- **Table of Contents** — Auto-generated from markdown headings with nested structure

### Planned
- **Git-backed Storage** — Real GitHub API integration for storing articles
- **Publish Log** — Track which commit SHA was published where and when
- **Inline Linting** — Linting panel with real-time writing quality feedback (mock data)
- **Multi-version Tracking** — Version timeline below editor (UI foundation in place)
- **Multi-platform Publishing** — Publish panel with platform-specific controls (UI foundation)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A GitHub account (for future auth and API integration)

### Installation

```bash
npm install
```

### Quick Start

```bash
npm run dev
```

Opens the dev server at `http://localhost:3000`. The app redirects `/` to `/studio` where the main editor interface lives.

## Architecture

### Current State (MVP)

The app is a **static UI prototype** with hardcoded mock data. The three-panel layout includes:

- **Left Panel**: Article list (selectable sidebar with draft/published status)
- **Center Panel**: Monaco editor for markdown with live preview toggle, zen mode, word count/reading time status bar, and version timeline below
- **Right Panel**: Tabbed interface with Lint results, Publish controls, and auto-generated Table of Contents

All articles, versions, and lint results are currently mocked—no real GitHub integration or authentication yet. The UI is feature-complete for the MVP scope.

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Styling**: Tailwind CSS v4 + CSS custom properties (GitHub Dark theme)
- **Deployment**: Vercel (intended)

### File Structure

```
src/
├── app/
│   ├── globals.css           # CSS custom properties (GitHub Dark theme)
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Redirect to /studio
│   └── studio/
│       └── page.tsx          # Main "use client" page; renders the three-panel UI
├── components/
│   ├── ArticleList.tsx       # Left panel (article sidebar)
│   ├── EditorPane.tsx        # Center panel (Monaco editor, preview, zen mode)
│   ├── SidePanel.tsx         # Right panel (tabbed interface)
│   ├── TocTab.tsx            # Table of contents auto-generated from headings
│   └── VersionStrip.tsx      # Version timeline (below editor)
└── hooks/
    └── useHeadingExtraction.ts  # Hook for extracting headings from markdown
```

### Styling Pattern

All components use Tailwind CSS combined with inline `style` props that reference CSS variables from `globals.css`:

```tsx
<div style={{ color: "var(--text-secondary)" }}>Content</div>
```

### Shared Types

The `Article` type is defined in `src/app/studio/page.tsx` and imported by other components.

## Next Steps (Post-MVP)

The UI is feature-complete. These backend features are planned:

- **Authentication**: NextAuth.js v5 + GitHub OAuth for user identity
- **GitHub API Integration**: Octokit.js for reading/writing articles to repository
- **Storage Structure**: Articles stored as `articles/{slug}/content.md` + `meta.json` + `publish-log.json`
- **API Routes**: `/api/articles`, `/api/articles/[slug]`, versions, lint, publish endpoints
- **Branching Strategy**: `drafts/` branch for auto-saves, `main` for published versions
- **Server-side Linting**: Integrate write-good, alex, Flesch-Kincaid for real analysis
- **Publish Integrations**: Connect to dev.to, Hashnode APIs for direct publishing
- **Auto-save**: Save drafts to GitHub on interval

## Development & Testing

### Scripts

- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
- `npm run start` — Serve production build
- `npm test` — Run Jest tests

### Notes

- Jest is configured for unit testing
- Quality gates enforce code quality standards
- TypeScript and ESLint errors are intentionally ignored in production builds (configured in `next.config.ts`)
- The entire app lives in a single "use client" component for simplicity during prototyping

## Spec-driven development (SDD) Flow

1. **Refine** — Use the claude `/architect <github-issue-url>` skill locally to generate technical specifications from the issue
2. **Implement** — Comment on the issue with `@claude develop task`
3. **Review** — Once the PR is created, verify the feature, and add comments if needed
4. **Merge** — Merge the PR when satisfied with the implementation

## License

MIT
