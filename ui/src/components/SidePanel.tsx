"use client";

import { useState } from "react";
import type { Article } from "@/app/studio/page";
import { TocTab } from "./TocTab";
import ChatTab from "./ChatTab";
import { exportToPdf, exportToMarkdown } from "@/utils/exportUtils";

type Props = {
  article: Article | null;
  activeTab: "lint" | "publish" | "toc" | "chat";
  onTabChange: (tab: "lint" | "publish" | "toc" | "chat") => void;
};

const PLATFORMS = [
  { id: "devto", name: "dev.to", status: "ready" as const },
  { id: "hashnode", name: "Hashnode", status: "ready" as const },
  { id: "medium", name: "Medium", status: "copy" as const },
  { id: "substack", name: "Substack", status: "copy" as const },
  { id: "linkedin", name: "LinkedIn", status: "copy" as const },
];

export function SidePanel({ article, activeTab, onTabChange }: Props) {
  const [lintResults, setLintResults] = useState<null | {
    readability: string;
    style: number;
    grammar: number;
    issues: { line: number; message: string }[];
  }>(null);

  const [exporting, setExporting] = useState(false);

  const runLint = () => {
    setLintResults({
      readability: "B+",
      style: 2,
      grammar: 0,
      issues: [
        { line: 5, message: 'Avoid "very" — it weakens your point' },
        { line: 12, message: "Consider active voice here" },
      ],
    });
  };

  const handlePrint = async () => {
    if (!article) return;
    setExporting(true);
    try {
      await exportToPdf(article, { fontSize: 14 });
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!article) return;
    exportToMarkdown(article);
  };

  return (
    <aside
      className="w-72 border-l flex flex-col overflow-hidden flex-1"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
    >
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
        {(["lint", "publish", "toc", "chat"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className="flex-1 py-2.5 text-xs uppercase font-semibold tracking-wider transition-colors"
            style={{
              color: activeTab === tab ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "lint" && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <button
            onClick={runLint}
            className="w-full py-2 text-sm rounded font-medium transition-colors"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
          >
            Run Lint ↺
          </button>

          {lintResults && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Readability
                  </span>
                  <span
                    className="text-sm font-mono font-semibold"
                    style={{ color: "var(--green)" }}
                  >
                    {lintResults.readability}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Style issues
                  </span>
                  <span
                    className="text-sm font-mono"
                    style={{ color: lintResults.style > 0 ? "var(--yellow)" : "var(--green)" }}
                  >
                    {lintResults.style}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Grammar errors
                  </span>
                  <span className="text-sm font-mono" style={{ color: "var(--green)" }}>
                    {lintResults.grammar}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Issues
                </h3>
                {lintResults.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="p-2 rounded text-xs"
                    style={{ background: "var(--bg-tertiary)" }}
                  >
                    <span className="font-mono" style={{ color: "var(--yellow)" }}>
                      Line {issue.line}:
                    </span>{" "}
                    <span style={{ color: "var(--text-primary)" }}>{issue.message}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!lintResults && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Click &quot;Run Lint&quot; to analyze your article for readability, style, and
              grammar.
            </p>
          )}
        </div>
      )}

      {activeTab === "publish" && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Platforms
          </h3>
          {PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              className="flex items-center justify-between p-3 rounded"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <span className="text-sm">{platform.name}</span>
              {platform.status === "ready" ? (
                <button
                  className="text-xs px-3 py-1 rounded font-medium transition-colors hover:opacity-80"
                  style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                >
                  Publish →
                </button>
              ) : (
                <button
                  className="text-xs px-3 py-1 rounded font-medium transition-colors hover:opacity-80"
                  style={{
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Copy ⎘
                </button>
              )}
            </div>
          ))}
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            Publishing logs which commit SHA was sent to each platform.
          </p>

          {/* Export section */}
          <div
            className="mt-6 pt-4 border-t flex flex-col gap-3"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={handlePrint}
              disabled={!article || exporting}
              className="w-full py-2 text-sm rounded font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 active:scale-95 cursor-pointer"
              style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
            >
              {exporting ? "Printing..." : "Print"}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              disabled={!article}
              className="w-full py-2 text-sm rounded font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 active:scale-95 cursor-pointer"
              style={{
                background: "transparent",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              Download
            </button>
          </div>
        </div>
      )}

      {activeTab === "toc" && article && <TocTab content={article.content} />}

      {activeTab === "chat" && (
        <div className="flex-1 p-4 flex flex-col overflow-hidden">
          <ChatTab />
        </div>
      )}
    </aside>
  );
}
