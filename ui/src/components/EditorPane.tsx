import { useState, useRef, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "github-markdown-css/github-markdown-dark.css";
import type { Article } from "@/app/studio/page";
import { MermaidBlock } from "./MermaidBlock";

const Editor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

function EditorFallback() {
  return (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}
    >
      Loading editor…
    </div>
  );
}

type Props = {
  article: Article;
  draftTitle?: string;
  draftTags?: string[];
  onChange: (content: string) => void;
  onTitleChange?: (title: string) => void;
  onTagsChange?: (tags: string[]) => void;
  theme?: "dark" | "light";
  zenMode?: boolean;
  onToggleZen?: () => void;
};

export function EditorPane({
  article,
  draftTitle,
  draftTags,
  onChange,
  onTitleChange,
  onTagsChange,
  theme = "dark",
  zenMode = false,
  onToggleZen,
}: Props) {
  // Fall back to article meta when draft props are not provided (e.g. in tests)
  const resolvedTitle = draftTitle ?? article.meta.title;
  const resolvedTags = draftTags ?? article.meta.tags;
  const [previewMode, setPreviewMode] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const words = article.content.trim() === "" ? 0 : article.content.trim().split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  const commitTag = () => {
    const trimmed = tagInput.trim().replace(/,$/, "").trim();
    if (trimmed && !resolvedTags.includes(trimmed)) {
      onTagsChange?.([...resolvedTags, trimmed]);
    }
    setTagInput("");
    setAddingTag(false);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag();
    }
    if (e.key === "Escape") {
      setTagInput("");
      setAddingTag(false);
    }
  };

  const removeTag = (tag: string) => {
    onTagsChange?.(resolvedTags.filter((t) => t !== tag));
  };

  const openTagInput = () => {
    setAddingTag(true);
    // Focus after render
    setTimeout(() => tagInputRef.current?.focus(), 0);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Editor toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input
            aria-label="Article title"
            value={resolvedTitle}
            onChange={(e) => onTitleChange?.(e.target.value)}
            className="title-input text-sm font-medium bg-transparent outline-none rounded px-1 w-full"
            style={{
              color: "var(--text-primary)",
              border: "1px solid transparent",
              minWidth: "60px",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--bg-tertiary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.background = "transparent";
            }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tag chips */}
          {resolvedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              {tag}
              <button
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(tag)}
                className="btn-tag-remove leading-none"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "0",
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                ×
              </button>
            </span>
          ))}

          {/* Inline tag input */}
          {addingTag && (
            <input
              ref={tagInputRef}
              aria-label="New tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTag}
              placeholder="tag…"
              className="text-xs rounded px-2 py-0.5 outline-none"
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                width: "80px",
              }}
            />
          )}

          {/* Add tag button */}
          {!addingTag && (
            <button
              aria-label="Add tag"
              onClick={openTagInput}
              className="btn-secondary text-xs px-2 py-0.5 rounded border"
              style={{
                background: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              +
            </button>
          )}

          {/* Preview toggle button */}
          <button
            onClick={() => setPreviewMode((p) => !p)}
            title={previewMode ? "Switch to editor" : "Switch to preview"}
            className="btn-icon rounded border flex items-center justify-center"
            data-active={previewMode}
            style={{
              width: "32px",
              height: "24px",
              background: previewMode ? "var(--accent)" : "var(--bg-tertiary)",
              color: previewMode ? "var(--bg-primary)" : "var(--text-secondary)",
              borderColor: previewMode ? "var(--accent)" : "var(--border)",
              cursor: "pointer",
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
              className="btn-icon rounded border flex items-center justify-center"
              data-active={zenMode}
              style={{
                width: "32px",
                height: "24px",
                background: zenMode ? "var(--accent)" : "var(--bg-tertiary)",
                color: zenMode ? "var(--bg-primary)" : "var(--text-secondary)",
                borderColor: zenMode ? "var(--accent)" : "var(--border)",
                cursor: "pointer",
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
        <Suspense fallback={<EditorFallback />}>
          <Editor
            height="100%"
            language="markdown"
            theme={theme === "dark" ? "vs-dark" : "light"}
            value={article.content}
            onChange={(value: string | undefined) => onChange(value ?? "")}
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
        </Suspense>
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
