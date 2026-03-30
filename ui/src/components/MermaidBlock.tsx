import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

type Props = { code: string };

export function MermaidBlock({ code }: Props) {
  const id = useId().replace(/:/g, "-"); // mermaid ids can't contain colons
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSvg(null);

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
        }}
      >
        Mermaid error: {error}
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
