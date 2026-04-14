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

This is a monorepo, that include everything related to the project, single source of truth. The only additional piece of information, are GitHub Issues and PR.

### Prerequisites

| Tool                                   | Version | Purpose                                                     |
| -------------------------------------- | ------- | ----------------------------------------------------------- |
| [GIT](https://git-scm.com)             | latest  | Version control, branching, commit history                  |
| [Node.js](https://nodejs.org)          | 24+     | Runtime and package manager                                 |
| [uv](https://docs.astral.sh/uv/)       | latest  | Python package manager (auto-installs Python 3.12 for api/) |
| [Task](https://taskfile.dev)           | latest  | Task runner for unified commands across UI and API          |
| [GitHub CLI](https://cli.github.com)   | latest  | GitHub repo management, OAuth app setup, MCP integration    |
| [Claude Code](https://claude.ai/code)  | latest  | AI-assisted spec and development workflow                   |

### Environment Setup

### Run locally

```bash
task install         # Install all dependencies (ui + api)
task quality-gate    # Run all quality checks, including tests (ui + api)
```

### API environment variables

Go to [.env](api/.env.example), follow the instructions in the comments to set up your environment variables.

Then run the app to ensure all works:

```bash
task dev
```

UI runs on <http://localhost:5173/inkwell/> and API on <http://localhost:8000> by default.

API docs are available at <http://localhost:8000/docs>, and MCP Inspector at <http://localhost:6274>.

LangSmith tracing could be found at <https://eu.smith.langchain.com/o/9ae609b5-c06d-4a4e-99e0-20626e7a8d68/projects/p/a1360a2d-dfa6-49bf-9719-a2622f52c44d?timeModel=%7B%22duration%22%3A%221d%22%7D>.

#### LangGraph Studio

```bash
task api:agent
```

This launches:

- **LangGraph API**: <http://127.0.0.1:2024/docs> (Swagger docs)
- **LangGraph Studio**: <https://smith.langchain.com/studio/\?baseUrl\=http://127.0.0.1:2024> (interactive UI)

### AI-Native SDLC

The project embraces an AI-native software development lifecycle, using Claude Code for spec writing, architecture design, and code generation. The `.claude/` directory contains all AI-generated content, including the project architecture document, agent definitions, and skill implementations.

```bash
task claude  # Start the AI code assistant
```

#### Architecture

See [CLAUDE.md](.claude/CLAUDE.md) for architecture, rules, commands, settle agents, skills, and a lot more.

<!-- TODO: Explain how to work with agents and skill, provide an examples -->
