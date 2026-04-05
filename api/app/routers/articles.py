from fastapi import APIRouter, HTTPException

from app.models.article import Article, ArticlePatch

# TODO: Add a ASCII Architecture diagram of how these resources work

router = APIRouter(prefix="/articles", tags=["articles"])

_store: dict[str, Article] = {
    a.slug: a
    for a in [
        Article(
            slug="getting-started-with-typescript",
            title="Getting Started with TypeScript",
            status="published",
            tags=["typescript", "beginner"],
            content="""# Getting Started with TypeScript

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
  return `# ${article.title}\\nTags: ${article.tags.join(", ")}`;
}
```

Types make your intent explicit. Your future self will thank you.
""",
        ),
        Article(
            slug="git-workflow-for-writers",
            title="Git Workflow for Writers",
            status="draft",
            tags=["git", "workflow", "writing"],
            content="""# Git Workflow for Writers

Treat your articles like code. Every draft is a branch, every revision is a commit.

## The Branch Strategy

```
main              ← published truth
  └── drafts/     ← work in progress
```

## Why This Works

1. **Full history** — see every revision, compare any two versions
2. **Safe experimentation** — branches are cheap, try bold edits
3. **Clean publishing** — squash-merge to main for a tidy log

> Write fearlessly. Git remembers everything.
""",
        ),
        Article(
            slug="building-a-writing-studio",
            title="Building a Writing Studio",
            status="draft",
            tags=["project", "next.js", "architecture"],
            content="""# Building a Writing Studio

What if your writing environment felt as powerful as your IDE?

## The Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 |
| Editor | Monaco |
| Storage | GitHub repo |
| Deploy | Vercel |

## Key Insight

Your GitHub repo already **is** a CMS. It has:
- Version control (commits)
- Branching (drafts vs published)
- Access control (collaborators)
- An API (Octokit)

We just need a UI on top.
""",
        ),
        Article(
            slug="visualizing-systems-with-mermaid",
            title="Visualizing Systems with Mermaid",
            status="draft",
            tags=["mermaid", "diagrams", "documentation"],
            content="""# Visualizing Systems with Mermaid

Mermaid lets you write diagrams as code — version-controlled, diff-able, and always in sync with your docs.

## Component Architecture

```mermaid
graph TD
    StudioPage --> ArticleList
    StudioPage --> EditorPane
    StudioPage --> SidePanel
    StudioPage --> VersionStrip
    EditorPane --> Monaco["Monaco Editor"]
    SidePanel --> LintTab["Lint Results"]
    SidePanel --> PublishTab["Publish Controls"]
    SidePanel --> TocTab["Table of Contents"]
```

Diagrams live next to the prose that describes them. No more stale architecture docs.
""",
        ),
    ]
}


@router.get("", response_model=list[Article])
def list_articles() -> list[Article]:
    return list(_store.values())


@router.get("/{slug}", response_model=Article)
def get_article(slug: str) -> Article:
    if slug not in _store:
        raise HTTPException(status_code=404, detail="Article not found")
    return _store[slug]


@router.post("", response_model=Article, status_code=201)
def create_article(article: Article) -> Article:
    if article.slug in _store:
        raise HTTPException(status_code=409, detail="Article slug already exists")
    _store[article.slug] = article
    return article


@router.patch("/{slug}", response_model=Article)
def patch_article(slug: str, patch: ArticlePatch) -> Article:
    if slug not in _store:
        raise HTTPException(status_code=404, detail="Article not found")
    existing = _store[slug]
    changes = {k: v for k, v in patch.model_dump().items() if v is not None}
    updated = existing.model_copy(update=changes)
    _store[slug] = updated
    return updated
