"use client";

import { useState } from "react";
import type { Article } from "@/app/studio/page";

type Props = {
  article: Article;
  activeTab: "lint" | "publish";
  onTabChange: (tab: "lint" | "publish") => void;
};

const PLATFORMS = [
  { id: "devto", name: "dev.to", status: "ready" as const },
  { id: "hashnode", name: "Hashnode", status: "ready" as const },
  { id: "medium", name: "Medium", status: "copy" as const },
  { id: "substack", name: "Substack", status: "copy" as const },
  { id: "linkedin", name: "LinkedIn", status: "copy" as const },
];

export function SidePanel({ _article, activeTab, onTabChange }: Props) {
  const [lintResults, setLintResults] = useState<null | {
    readability: string;
    style: number;
    grammar: number;
    issues: { line: number; message: string }[];
  }>(null);

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

  return (
    <aside
      className="w-72 flex-shrink-0 border-l flex flex-col overflow-y-auto"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
    >
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
        {(["lint", "publish"] as const).map((tab) => (
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
        <div className="p-4 flex flex-col gap-4">
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
        <div className="p-4 flex flex-col gap-3">
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
        </div>
      )}
    </aside>
  );
}
