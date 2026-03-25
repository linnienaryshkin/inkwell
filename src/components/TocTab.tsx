"use client";

import { useHeadingExtraction, type Heading } from "@/hooks/useHeadingExtraction";

type Props = {
  content: string;
  onHeadingClick?: (lineNumber: number) => void;
};

export function TocTab({ content, onHeadingClick }: Props) {
  const headings = useHeadingExtraction(content);

  if (!headings.length) {
    return (
      <div className="p-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        No headings found
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2 overflow-y-auto">
      <HeadingsList headings={headings} onHeadingClick={onHeadingClick} />
    </div>
  );
}

type HeadingsListProps = {
  headings: Heading[];
  onHeadingClick?: (lineNumber: number) => void;
  depth?: number;
};

function HeadingsList({ headings, onHeadingClick, depth = 0 }: HeadingsListProps) {
  return (
    <>
      {headings.map((heading) => (
        <div key={heading.id}>
          <button
            onClick={() => onHeadingClick?.(heading.lineNumber)}
            className="w-full text-left text-xs py-1.5 rounded transition-colors hover:opacity-80"
            style={{
              paddingLeft: `${depth * 16}px`,
              color: "var(--text-primary)",
              fontWeight: "400",
              backgroundColor: "transparent",
            }}
          >
            {heading.text}
          </button>

          {heading.children && (
            <HeadingsList
              headings={heading.children}
              onHeadingClick={onHeadingClick}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}
