"use client";

import type { ArticleSummary } from "@/app/studio/page";

type Props = {
  articles: ArticleSummary[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

export function ArticleList({ articles, selectedSlug, onSelect }: Props) {
  return (
    <aside
      className="w-60 flex-shrink-0 border-r overflow-y-auto flex flex-col"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Articles
        </h2>
      </div>
      <div className="flex-1 py-1">
        {articles.map((article) => (
          <button
            key={article.slug}
            onClick={() => onSelect(article.slug)}
            className="w-full text-left px-4 py-2.5 flex flex-col gap-0.5 transition-colors"
            style={{
              background: article.slug === selectedSlug ? "var(--bg-tertiary)" : "transparent",
              borderLeft:
                article.slug === selectedSlug ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
              {article.title}
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-xs"
                style={{
                  color: article.status === "published" ? "var(--green)" : "var(--yellow)",
                }}
              >
                {article.status}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {article.slug}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          className="w-full py-2 text-sm rounded border text-center transition-colors hover:opacity-80"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            background: "var(--bg-tertiary)",
          }}
        >
          + New Article
        </button>
      </div>
    </aside>
  );
}
