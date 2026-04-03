# [Inkwell](https://github.com/linnienaryshkin/inkwell)

A browser-based markdown writing studio for developer-writers.

Inkwell puts Monaco editor at the center of your writing workflow. Every save becomes a GitHub commit, articles are stored directly in your repository, and the app tracks where and when each version was published — making your GitHub repo the CMS.

Deployed version: <https://linnienaryshkin.github.io/inkwell/>

## Objective

Give developer-writers a distraction-free, code-quality writing environment that feels like an IDE: syntax highlighting, inline linting, version history from Git, and one-click publishing to platforms like dev.to and Hashnode — all without leaving the browser.

## Plans

### Now (MVP — UI prototype + API backend)

- Three-panel studio layout (article list / Monaco editor / lint + publish sidebar)
- Live markdown preview with GFM support
- Zen mode, word count, reading time
- Auto-generated table of contents from headings
- Version timeline strip (UI only, mock data)
- Inline lint results panel (UI only, mock data)
- Publish controls panel (UI only, mock data)
- FastAPI backend with article CRUD (in-memory store, phase 1)
- UI connects to API with automatic fallback to mock data for static demo

### [Next (backend integration)](https://github.com/linnienaryshkin/inkwell/milestone/1)

- **Auth** — GitHub OAuth
- **Storage** — Octokit.js; articles stored as `articles/{slug}/content.md` + `meta.json` + `publish-log.json`
- **Persistence** — swap in-memory store for SQLite/Postgres
- **Branching** — `drafts/` branch for auto-saves, `main` for published checkpoints
- **Linting** — write-good + alex + Flesch-Kincaid (server-side, via `api/app/ai/`)
- **Publishing** — dev.to and Hashnode API integrations
- **Publish log** — track commit SHA, platform, and timestamp per published version

## Development | "Everything as code"

### Prerequisites

| Tool                                   | Version | Purpose                                                     |
| -------------------------------------- | ------- | ----------------------------------------------------------- |
| [GIT](https://git-scm.com)             | latest  | Version control, branching, commit history                   |
| [Node.js](https://nodejs.org)          | 24+     | Runtime and package manager                                 |
| [uv](https://docs.astral.sh/uv/)       | latest  | Python package manager (auto-installs Python 3.12 for api/) |
| [Claude Code](https://claude.ai/code)  | latest  | AI-assisted spec and development workflow                   |

### Environment Setup

**GitHub MCP Integration:**

The project uses Claude Code's GitHub MCP server for AI-assisted workflows. To enable GitHub integration:

1. **Generate a GitHub Personal Access Token (PAT):**
   - Go to <https://github.com/settings/tokens/new>
   - Select scopes: `repo`, `read:org`, `read:user`
   - Copy the token

2. **Create `.env` file and add your token:**

```bash
cp .env.example .env
nano .env  # Add your GITHUB_TOKEN
```

1. **Load environment and launch Claude Code:**

```bash
source .dev-env && codemie-claude
```

```bash
source .dev-env && claude
```

For detailed setup instructions, see [GITHUB_MCP_SETUP.md](./GITHUB_MCP_SETUP.md).

**Or, quick one-liner:**

```bash
export GITHUB_TOKEN=<your-token> && claude
```

**Or, add environment variable to your shell configuration:**

```bash
echo 'export GITHUB_TOKEN=<your-token>' >> ~/.zshrc
source ~/.zshrc
```

### Run locally

Makefile shortcuts from the repo root:

```bash
make dev-ui     # Start Vite dev server
make dev-api    # Start FastAPI dev server
make test-ui    # Run UI tests
make test-api   # Run API tests
```

### Development guide

See [CLAUDE.md](.claude/CLAUDE.md) for commands, architecture, testing rules, and available skills.

### Spec-Driven Development

Inkwell uses an SDD flow powered by Claude Code and GitHub Issues.

1. **Architect** — Paste the GitHub issue URL into Claude Code. The `architect-agent` reads the issue, explores the codebase, asks clarifying questions, and writes a detailed spec as a comment on the issue.
2. **Implement** — Comment on the issue with `@claude develop task`. Claude Code picks up the spec and opens a PR.
3. **Review** — Inspect the PR. Add review comments if needed; Claude iterates.
4. **Merge** — Merge when satisfied.

This keeps design decisions traceable to issues and implementation traceable to specs.
