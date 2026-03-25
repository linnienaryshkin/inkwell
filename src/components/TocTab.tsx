"use client";

import { useRef } from "react";
import { useHeadingExtraction, type Heading } from "@/hooks/useHeadingExtraction";
import { useScrollTracking } from "@/hooks/useScrollTracking";
import { useAnchorNavigation } from "@/hooks/useAnchorNavigation";

type Props = {
  content: string;
};

export function TocTab({ content }: Props) {
  const editorRef = useRef<HTMLElement | null>(null);
  const headings = useHeadingExtraction(content);
  const currentHeadingId = useScrollTracking(headings, editorRef.current);
  const { scrollToHeading } = useAnchorNavigation(editorRef.current);

  // Try to find the Monaco editor element
  if (typeof window !== "undefined" && !editorRef.current) {
    const editor = document.querySelector(".monaco-editor") as HTMLElement;
    if (editor) {
      editorRef.current = editor.closest(".overflow-hidden") as HTMLElement;
    }
  }

  if (!headings.length) {
    return (
      <div className="p-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        No headings found
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2 overflow-y-auto">
      <HeadingsList
        headings={headings}
        currentHeadingId={currentHeadingId}
        onHeadingClick={scrollToHeading}
      />
    </div>
  );
}

type HeadingsListProps = {
  headings: Heading[];
  currentHeadingId: string | null;
  onHeadingClick: (id: string) => void;
  depth?: number;
};

function HeadingsList({
  headings,
  currentHeadingId,
  onHeadingClick,
  depth = 0,
}: HeadingsListProps) {
  return (
    <>
      {headings.map((heading) => (
        <div key={heading.id}>
          <button
            onClick={() => onHeadingClick(heading.id)}
            className="w-full text-left text-xs py-1.5 rounded transition-colors hover:opacity-80"
            style={{
              paddingLeft: `${depth * 16}px`,
              color: currentHeadingId === heading.id ? "var(--accent)" : "var(--text-primary)",
              fontWeight: currentHeadingId === heading.id ? "600" : "400",
              backgroundColor:
                currentHeadingId === heading.id ? "var(--bg-tertiary)" : "transparent",
            }}
            aria-current={currentHeadingId === heading.id ? "page" : undefined}
          >
            {heading.text}
          </button>

          {heading.children && (
            <HeadingsList
              headings={heading.children}
              currentHeadingId={currentHeadingId}
              onHeadingClick={onHeadingClick}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}
