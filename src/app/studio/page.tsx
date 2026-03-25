"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [zenMode, setZenMode] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const selectedArticle = articles.find((a) => a.slug === selectedSlug)!;

  const handleContentChange = (newContent: string) => {
    setArticles((prev) =>
      prev.map((a) => (a.slug === selectedSlug ? { ...a, content: newContent } : a))
    );
  };

  const toggleZen = useCallback(() => setZenMode((z) => !z), []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleZen();
      }
      if (e.key === "z" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        toggleZen();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleZen]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-secondary)",
          transition: "max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease",
          maxHeight: zenMode ? "0" : "64px",
          overflow: "hidden",
          opacity: zenMode ? 0 : 1,
          paddingTop: zenMode ? "0" : undefined,
          paddingBottom: zenMode ? "0" : undefined,
        }}
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
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="text-xs px-2 py-1 rounded border"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
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
        <div
          style={{
            transition: "max-width 0.3s ease, opacity 0.3s ease",
            maxWidth: zenMode ? "0" : "280px",
            opacity: zenMode ? 0 : 1,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <ArticleList articles={articles} selectedSlug={selectedSlug} onSelect={setSelectedSlug} />
        </div>

        {/* Editor */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ position: "relative" }}>
          <EditorPane
            key={selectedSlug}
            article={selectedArticle}
            onChange={handleContentChange}
            theme={theme}
          />
          <VersionStrip slug={selectedSlug} />

          {/* Expand/Zen mode button */}
          <button
            onClick={toggleZen}
            title={zenMode ? "Exit expand mode" : "Enter expand mode"}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: zenMode ? "var(--accent)" : "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              color: zenMode ? "var(--bg-primary)" : "var(--text-secondary)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "12px",
              cursor: "pointer",
              transition: "background 0.2s ease, color 0.2s ease",
              zIndex: 10,
            }}
          >
            ⛶
          </button>
        </div>

        {/* Side panel */}
        <div
          style={{
            transition: "max-width 0.3s ease, opacity 0.3s ease",
            maxWidth: zenMode ? "0" : "320px",
            opacity: zenMode ? 0 : 1,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <SidePanel
            article={selectedArticle}
            activeTab={sidePanelTab}
            onTabChange={setSidePanelTab}
          />
        </div>
      </div>
    </div>
  );
}
