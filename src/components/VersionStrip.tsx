"use client";

import { useState } from "react";

type Props = {
  slug: string;
};

const MOCK_VERSIONS = [
  { sha: "abc1234", message: "Update intro paragraph", date: "today 14:02", active: true },
  { sha: "def5678", message: "Add code examples", date: "yesterday 11:30", active: false },
  { sha: "aaa9999", message: "Initial draft", date: "3 days ago", active: false },
];

export function VersionStrip({ _slug }: Props) {
  const [selectedSha, setSelectedSha] = useState(MOCK_VERSIONS[0].sha);

  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 border-t overflow-x-auto"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
    >
      <h3
        className="text-xs font-semibold uppercase tracking-wider flex-shrink-0"
        style={{ color: "var(--text-secondary)" }}
      >
        Versions
      </h3>
      <div className="flex items-center gap-3">
        {MOCK_VERSIONS.map((v) => (
          <button
            key={v.sha}
            onClick={() => setSelectedSha(v.sha)}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap"
            style={{
              background: v.sha === selectedSha ? "var(--bg-tertiary)" : "transparent",
              border: v.sha === selectedSha ? "1px solid var(--border)" : "1px solid transparent",
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: v.sha === selectedSha ? "var(--accent)" : "var(--text-secondary)",
              }}
            />
            <span className="font-mono" style={{ color: "var(--accent)" }}>
              {v.sha}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>{v.date}</span>
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <button
          className="text-xs px-2 py-1 rounded border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Restore
        </button>
        <button
          className="text-xs px-2 py-1 rounded border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          View diff
        </button>
      </div>
    </div>
  );
}
