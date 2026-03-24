"use client";

import { useState } from "react";
import { ArticleList } from "@/components/ArticleList";
import { EditorPane } from "@/components/EditorPane";
import { SidePanel } from "@/components/SidePanel";
import { VersionStrip } from "@/components/VersionStrip";

export type Article = {
  slug: string;
  title: string;
  status: "draft" | "published";
  content: string;
  tags: string[];
};

const MOCK_ARTICLES: Article[] = [
  {
    slug: "getting-started-with-typescript",
    title: "Getting Started with TypeScript",
    status: "published",
    tags: ["typescript", "beginner"],
    content: `# Getting Started with TypeScript

TypeScript adds static type checking to JavaScript, catching errors before they reach production.

## Why TypeScript?

- **Catch bugs early** — type errors surface at compile time, not runtime
- **Better IDE support** — autocomplete, refactoring, and inline docs
- **Self-documenting** — types serve as living documentation

## Quick Setup

\`\`\`bash
npm init -y
npm install typescript --save-dev
npx tsc --init
\`\`\`

## Your First Type

\`\`\`typescript
interface Article {
  title: string;
  slug: string;
  tags: string[];
  publishedAt?: Date;
}

function formatArticle(article: Article): string {
  return \`# \${article.title}\\nTags: \${article.tags.join(", ")}\`;
}
\`\`\`

Types make your intent explicit. Your future self will thank you.
`,
  },
  {
    slug: "git-workflow-for-writers",
    title: "Git Workflow for Writers",
    status: "draft",
    tags: ["git", "workflow", "writing"],
    content: `# Git Workflow for Writers

Treat your articles like code. Every draft is a branch, every revision is a commit.

## The Branch Strategy

\`\`\`
main              ← published truth
  └── drafts/     ← work in progress
\`\`\`

## Why This Works

1. **Full history** — see every revision, compare any two versions
2. **Safe experimentation** — branches are cheap, try bold edits
3. **Clean publishing** — squash-merge to main for a tidy log

> Write fearlessly. Git remembers everything.
`,
  },
  {
    slug: "building-a-writing-studio",
    title: "Building a Writing Studio",
    status: "draft",
    tags: ["project", "next.js", "architecture"],
    content: `# Building a Writing Studio

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
`,
  },
];

export default function StudioPage() {
  const [selectedSlug, setSelectedSlug] = useState(MOCK_ARTICLES[0].slug);
  const [articles, setArticles] = useState(MOCK_ARTICLES);
  const [sidePanelTab, setSidePanelTab] = useState<"lint" | "publish">("publish");

  const selectedArticle = articles.find((a) => a.slug === selectedSlug)!;

  const handleContentChange = (newContent: string) => {
    setArticles((prev) =>
      prev.map((a) => (a.slug === selectedSlug ? { ...a, content: newContent } : a))
    );
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--accent)" }}>
            Inkwell
          </h1>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Personal Writing Studio
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            my-writing-repo
          </span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
          >
            IN
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Article list */}
        <ArticleList
          articles={articles}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
        />

        {/* Editor */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <EditorPane article={selectedArticle} onChange={handleContentChange} />
          <VersionStrip slug={selectedSlug} />
        </div>

        {/* Side panel */}
        <SidePanel
          article={selectedArticle}
          activeTab={sidePanelTab}
          onTabChange={setSidePanelTab}
        />
      </div>
    </div>
  );
}
