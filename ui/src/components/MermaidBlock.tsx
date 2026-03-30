import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

type Props = { code: string };

const MAX_PREVIEW_LENGTH = 120;

export function MermaidBlock({ code }: Props) {
  const id = useId().replace(/:/g, "-"); // mermaid ids can't contain colons
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSvg(null);
    setExpanded(false);

    mermaid
      .render(`mermaid-${id}`, code)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    const isLong = error.length > MAX_PREVIEW_LENGTH;
    const displayedError = isLong && !expanded ? error.slice(0, MAX_PREVIEW_LENGTH) + "…" : error;

    return (
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "rgba(248, 81, 73, 0.1)",
          color: "#f85149",
          fontFamily: "monospace",
          fontSize: "12px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        <span>Mermaid error: {displayedError}</span>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Show less" : "Show full error"}
            style={{
              marginLeft: "8px",
              background: "none",
              border: "none",
              color: "#f85149",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "12px",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {expanded ? "show less" : "show more"}
          </button>
        )}
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Rendering diagram…</div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} style={{ overflowX: "auto" }} />;
}
