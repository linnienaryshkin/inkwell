"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "github-markdown-css/github-markdown-dark.css";
import type { Article } from "@/app/studio/page";
import { MermaidBlock } from "./MermaidBlock";

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
  theme?: "dark" | "light";
  zenMode?: boolean;
  onToggleZen?: () => void;
};

export function EditorPane({
  article,
  onChange,
  theme = "dark",
  zenMode = false,
  onToggleZen,
}: Props) {
  const [previewMode, setPreviewMode] = useState(false);

  const words = article.content.trim() === "" ? 0 : article.content.trim().split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));

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
          {/* Preview toggle button */}
          <button
            onClick={() => setPreviewMode((p) => !p)}
            title={previewMode ? "Switch to editor" : "Switch to preview"}
            className="rounded border flex items-center justify-center"
            style={{
              width: "32px",
              height: "24px",
              background: previewMode ? "var(--accent)" : "var(--bg-tertiary)",
              color: previewMode ? "var(--bg-primary)" : "var(--text-secondary)",
              borderColor: previewMode ? "var(--accent)" : "var(--border)",
              cursor: "pointer",
              transition: "background 0.15s ease, color 0.15s ease",
              fontSize: "14px",
            }}
          >
            {previewMode ? "✎" : "👁"}
          </button>

          {/* Expand button */}
          {onToggleZen && (
            <button
              onClick={onToggleZen}
              title={zenMode ? "Exit expand mode" : "Enter expand mode"}
              className="rounded border flex items-center justify-center"
              style={{
                width: "32px",
                height: "24px",
                background: zenMode ? "var(--accent)" : "var(--bg-tertiary)",
                color: zenMode ? "var(--bg-primary)" : "var(--text-secondary)",
                borderColor: zenMode ? "var(--accent)" : "var(--border)",
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease",
                fontSize: "14px",
              }}
            >
              ⛶
            </button>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden" style={{ display: previewMode ? "none" : "block" }}>
        <Editor
          height="100%"
          language="markdown"
          theme={theme === "dark" ? "vs-dark" : "light"}
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

      {/* Markdown Preview */}
      {previewMode && (
        <div
          className="flex-1 overflow-auto p-6 markdown-body"
          style={{ background: "var(--bg-primary)" }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children }) {
                const lang = /language-(\w+)/.exec(className ?? "")?.[1];
                if (lang === "mermaid") {
                  return <MermaidBlock code={String(children).trim()} />;
                }
                return <code className={className}>{children}</code>;
              },
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>
      )}

      {/* Status bar */}
      <div
        data-testid="status-bar"
        className="text-xs px-4 py-1 border-t"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-secondary)",
          color: "var(--text-secondary)",
        }}
      >
        {words} {words === 1 ? "word" : "words"} · {readingTime} min read
      </div>
    </div>
  );
}
