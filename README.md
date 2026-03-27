# [Inkwell](https://github.com/linnienaryshkin/inkwell)

A browser-based markdown writing studio for developer-writers.

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

**Prerequisites**

| Tool                                  | Version | Purpose                                   |
| ------------------------------------- | ------- | ----------------------------------------- |
| [Node.js](https://nodejs.org)         | 24+     | Runtime and package manager               |
| [gh](https://cli.github.com)          | latest  | GitHub CLI — used in the SDD workflow     |
| [Claude Code](https://claude.ai/code) | latest  | AI-assisted spec and development workflow |

**Install dependencies**

```bash
npm ci
```

**Development Guide**

For further development, follow [CLAUDE.md](.claude/CLAUDE.md)

**Spec-Driven Development**

Inkwell uses an SDD flow powered by Claude Code and GitHub Issues.

1. **Architect** — Run `/architect <github-issue-url>` locally to generate a technical spec from the issue. The skill reads the issue, explores the codebase, and writes a detailed implementation plan as a comment.
2. **Implement** — Comment on the issue with `@claude develop task`. Claude Code picks up the spec and opens a PR.
3. **Review** — Inspect the PR. Add review comments if changes are needed; Claude iterates.
4. **Merge** — Merge when satisfied.

This keeps design decisions traceable to issues and implementation traceable to specs.
