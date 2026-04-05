"use client";

import { useState, useEffect, useRef } from "react";
import type { ArticleVersion } from "@/app/studio/page";

const REPO_URL = "https://github.com/linnienaryshkin/inkwell";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  slug: string;
  versions?: ArticleVersion[];
  isDirty?: boolean;
  saving?: boolean;
  deleting?: boolean;
  onSave?: () => void;
  onDelete?: () => void;
};

export function VersionStrip({
  slug,
  versions = [],
  isDirty = false,
  saving = false,
  deleting = false,
  onSave,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset menu when article changes
  useEffect(() => {
    setMenuOpen(false);
  }, [slug]);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 border-t"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-secondary)",
        position: "relative",
      }}
    >
      {/* Versions dropdown trigger */}
      <div style={{ position: "relative" }}>
        <button
          ref={buttonRef}
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-versions flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
          style={{
            color: menuOpen ? "var(--text-primary)" : "var(--text-secondary)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Versions
          {versions.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                fontWeight: 400,
                fontSize: "0.7rem",
                letterSpacing: 0,
              }}
            >
              {versions.length}
            </span>
          )}
          <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>{menuOpen ? "▲" : "▼"}</span>
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              minWidth: "240px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              zIndex: 50,
              overflow: "hidden",
            }}
          >
            {versions.length === 0 ? (
              <div className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                No versions yet
              </div>
            ) : (
              versions.map((v) => (
                <a
                  key={v.sha}
                  href={`${REPO_URL}/commit/${v.sha}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="version-link flex items-center justify-between px-4 py-2.5 text-xs"
                  style={{
                    display: "flex",
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span className="truncate flex-1" style={{ color: "var(--text-primary)" }}>
                    {v.message}
                  </span>
                  <span className="flex-shrink-0 ml-3" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(v.committed_at)}
                  </span>
                </a>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {slug !== "__new__" && (
          <button
            onClick={onDelete}
            disabled={deleting || saving}
            title="Delete article"
            className="btn-danger text-xs px-3 py-1 rounded border"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--red)",
              cursor: deleting || saving ? "not-allowed" : "pointer",
              opacity: deleting || saving ? 0.4 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        <button
          onClick={onSave ?? (() => {})}
          disabled={!isDirty || saving}
          title={isDirty ? "Save changes" : "No unsaved changes"}
          className="btn-save text-xs px-3 py-1 rounded border"
          style={{
            borderColor: isDirty ? "var(--green)" : "var(--border)",
            background: isDirty ? "var(--green)" : "transparent",
            color: isDirty ? "var(--bg-primary)" : "var(--text-secondary)",
            fontWeight: isDirty ? 600 : 400,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
