import { useMemo } from "react";

export interface Heading {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  lineNumber: number;
  children?: Heading[];
}

/**
 * Generates a URL-safe slug from heading text
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-"); // Replace multiple hyphens with single hyphen
}

/**
 * Extracts all headings from markdown content, filtered by code blocks.
 * Handles duplicate IDs by appending -2, -3, etc.
 */
export function useHeadingExtraction(content: string): Heading[] {
  return useMemo(() => {
    if (!content.trim()) return [];

    const lines = content.split("\n");
    const headings: Heading[] = [];
    const idMap = new Map<string, number>(); // Track duplicate IDs

    // Track which lines are in code blocks
    const inCodeBlock = new Array(lines.length).fill(false);
    let currentlyInCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("```")) {
        currentlyInCodeBlock = !currentlyInCodeBlock;
      }
      if (currentlyInCodeBlock) {
        inCodeBlock[i] = true;
      }
    }

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];

      // Skip if we're in a code block
      if (inCodeBlock[lineNumber]) continue;

      // Match markdown heading (# ## ### etc.)
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) continue;

      const hashes = match[1];
      const text = match[2].trim();
      const level = hashes.length as 1 | 2 | 3 | 4 | 5 | 6;

      // Generate unique ID
      const baseId = `heading-${generateSlug(text)}`;
      let id = baseId;
      const count = (idMap.get(baseId) ?? 0) + 1;
      idMap.set(baseId, count);

      if (count > 1) {
        id = `${baseId}-${count}`;
      }

      headings.push({
        id,
        level,
        text,
        lineNumber,
      });
    }

    // Build hierarchy
    const hierarchy = buildHierarchy(headings);
    return hierarchy;
  }, [content]);
}

/**
 * Builds a hierarchical structure from flat heading list
 */
function buildHierarchy(headings: Heading[]): Heading[] {
  if (!headings.length) return [];

  const result: Heading[] = [];
  const stack: Heading[] = [];

  for (const heading of headings) {
    // Pop stack until we find the correct parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(heading);
    } else {
      result.push(heading);
    }

    stack.push(heading);
  }

  return result;
}
