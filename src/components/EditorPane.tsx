"use client";

import dynamic from "next/dynamic";
import type { Article } from "@/app/studio/page";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}
    >
      Loading editor…
    </div>
  ),
});

type Props = {
  article: Article;
  onChange: (content: string) => void;
};

export function EditorPane({ article, onChange }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Editor toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{article.title}</span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            content.md
          </span>
        </div>
        <div className="flex items-center gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language="markdown"
          theme="vs-dark"
          value={article.content}
          onChange={(value) => onChange(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 16 },
            wordWrap: "on",
            lineNumbers: "on",
            renderLineHighlight: "gutter",
            scrollBeyondLastLine: false,
            cursorBlinking: "smooth",
            smoothScrolling: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
