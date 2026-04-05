"use client";

import { useState, useEffect } from "react";
import type { ArticleVersion } from "@/app/studio/page";

type Props = {
  slug: string;
  versions?: ArticleVersion[];
  isDirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
};

export function VersionStrip({
  slug,
  versions = [],
  isDirty = false,
  saving = false,
  onSave,
}: Props) {
  const [selectedSha, setSelectedSha] = useState<string | null>(
    versions.length > 0 ? versions[0].sha : null
  );

  // Reset selected SHA whenever the article changes (slug or versions list)
  useEffect(() => {
    setSelectedSha(versions.length > 0 ? versions[0].sha : null);
  }, [slug]);

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
        {versions.map((v) => (
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
              {v.sha.slice(0, 7)}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>{v.committed_at}</span>
            <span style={{ color: "var(--text-secondary)" }}>{v.message}</span>
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
        <button
          onClick={onSave ?? (() => {})}
          disabled={saving}
          className="text-xs px-3 py-1 rounded border transition-colors"
          style={{
            borderColor: isDirty ? "var(--green)" : "var(--border)",
            background: isDirty ? "var(--green)" : "transparent",
            color: isDirty ? "var(--bg-primary)" : "var(--text-secondary)",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            fontWeight: isDirty ? 600 : 400,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
