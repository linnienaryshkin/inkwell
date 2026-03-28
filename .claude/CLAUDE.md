# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Commands

```bash
npm run dev          # Vite dev server at localhost:5173/inkwell/ (production: https://linnienaryshkin.github.io/inkwell/)
npm run build        # Vite production build → dist/
npm run preview      # Serve the dist/ build locally to test before deploy
npm run lint         # ESLint auto-fix
npm run format       # Prettier auto-format
npm test             # Jest (no coverage threshold)
npm run test:coverage  # Jest with 90% coverage threshold (enforced in CI)
npm run security     # npm audit --audit-level=high

# Run a single test file
npx jest src/components/EditorPane.test.tsx --no-coverage

# Full quality gate (same order as CI)
npm run quality-gate
```

## Architecture

Vite + React SPA. `src/main.tsx` is the entry point — it renders `StudioPage` directly. All UI state lives in `src/app/studio/page.tsx`.

**Three-panel layout:**

- **Left** – `ArticleList`: selects the active article
- **Center** – `EditorPane`: Monaco editor + ReactMarkdown preview (toggled), Mermaid diagram rendering via `MermaidBlock`, status bar. `EditorPane` receives `key={selectedSlug}` — this intentionally forces a full remount when the article changes, resetting Monaco's internal state. `VersionStrip` renders below it (version timeline, mock data; "Restore" and "View diff" buttons are not yet wired up)
- **Right** – `SidePanel`: lint / publish / TOC tabs. Lint results are mock (hardcoded readability score + two example issues). Publish tab lists five hardcoded platforms (dev.to, Hashnode, Medium, Substack, LinkedIn) — no real API calls yet

**State ownership rules** (enforced by `ui-engineer` skill):

- Global state (`selectedSlug`, `articles[]`, `zenMode`, `theme`, `sidePanelTab`) lives in `StudioPage` and flows down as props
- Component-local state (e.g., `previewMode` in `EditorPane`, `lintResults` in `SidePanel`) stays in the component that owns it
- The `Article` type is defined in `studio/page.tsx` — import it from there, don't redefine

**Keyboard shortcuts:** `F11` or `Ctrl+Shift+Z` toggle zen mode (collapses header, article list, and side panel).

**Theming:** `data-theme` attribute on `<html>` switches between dark (default) and light CSS variable sets defined in `src/app/globals.css`. Always use CSS variables for colors (`var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-tertiary)`, `var(--border)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--accent)`, `var(--accent-hover)`, `var(--green)`, `var(--yellow)`, `var(--red)`). Use Tailwind for layout/spacing only.

**Path alias:** `@/` resolves to `src/`. Use it for all internal imports.

**Custom hook:** `src/hooks/useHeadingExtraction.ts` — parses markdown into a nested heading tree for the TOC tab.

**Current state:** Pure UI prototype. All article data is hardcoded mock data. No backend, auth, or real GitHub integration yet.

## Testing

Rules are in `.claude/rules/testing.md`. Key points:

- Test files colocated with components as `ComponentName.test.tsx`
- Test user behavior, not implementation internals
- Query priority: `getByRole` > `getByLabelText` > `getByText` > `data-testid`
- Mock only external libraries (Monaco, ReactMarkdown); never mock internal components
- 90% coverage required on branches, functions, lines, and statements

## Skills

- `/architect <issue-url>` — fetches a GitHub issue, asks clarifying questions, writes a technical spec, posts it as a comment, and labels the issue `refined`
- `/git-commit [ISSUE_ID] [description]` — runs the full quality gate then commits with `#ISSUE: description` format
- `/ui-engineer` — invoked automatically for UI changes; enforces state ownership and styling rules
- `/devops` — invoked automatically for CI/CD changes; manages workflow files, branch protection, deployment environment, and GitHub Pages config
- `claude-code-action` — GitHub Actions agent; communicates exclusively via GitHub comment updates (console output is invisible to users); only acts on the comment containing `@claude`
