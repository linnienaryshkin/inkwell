import { renderHook } from "@testing-library/react";
import { useHeadingExtraction } from "./useHeadingExtraction";

describe("useHeadingExtraction", () => {
  describe("Basic heading extraction", () => {
    it("should extract all heading levels", () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings).toHaveLength(1);
      expect(headings[0].level).toBe(1);
      expect(headings[0].text).toBe("H1");

      expect(headings[0].children).toHaveLength(1);
      expect(headings[0].children![0].level).toBe(2);
      expect(headings[0].children![0].text).toBe("H2");
    });

    it("should extract heading text correctly", () => {
      const content = `# Getting Started
## Installation
## Configuration`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].text).toBe("Getting Started");
      expect(headings[0].children).toHaveLength(2);
      expect(headings[0].children![0].text).toBe("Installation");
      expect(headings[0].children![1].text).toBe("Configuration");
    });

    it("should include line numbers", () => {
      const content = `# Heading 1

## Heading 2`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].lineNumber).toBe(0);
      expect(headings[0].children![0].lineNumber).toBe(2);
    });
  });

  describe("ID generation", () => {
    it("should generate URL-safe IDs from heading text", () => {
      const content = `# Getting Started
## Quick Setup`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].id).toBe("heading-getting-started");
      expect(headings[0].children![0].id).toBe("heading-quick-setup");
    });

    it("should handle special characters in heading text", () => {
      const content = `# Hello, World! (2024)
## Advanced C++ Patterns`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].id).toBe("heading-hello-world-2024");
      expect(headings[0].children![0].id).toBe("heading-advanced-c-patterns");
    });

    it("should handle duplicate heading IDs", () => {
      const content = `# Introduction
## Installation
## Installation
## Installation`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;
      const children = headings[0].children || [];

      expect(children[0].id).toBe("heading-installation");
      expect(children[1].id).toBe("heading-installation-2");
      expect(children[2].id).toBe("heading-installation-3");
    });

    it("should handle whitespace in heading text", () => {
      const content = `#   Leading and trailing spaces
## Multiple   spaces   between`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].text).toBe("Leading and trailing spaces");
      expect(headings[0].id).toBe("heading-leading-and-trailing-spaces");
    });
  });

  describe("Code block filtering", () => {
    it("should ignore headings inside code blocks", () => {
      const content = `# Main Heading

\`\`\`markdown
# Code Block Heading
## Not extracted
\`\`\`

## Real Heading`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe("Main Heading");
      expect(headings[0].children).toHaveLength(1);
      expect(headings[0].children![0].text).toBe("Real Heading");
    });

    it("should handle multiple code blocks", () => {
      const content = `# Introduction

\`\`\`
# Code 1
\`\`\`

## Section 1

\`\`\`javascript
# Code 2
\`\`\`

## Section 2`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      const children = headings[0].children || [];
      expect(children).toHaveLength(2);
      expect(children[0].text).toBe("Section 1");
      expect(children[1].text).toBe("Section 2");
    });

    it("should handle nested code blocks", () => {
      const content = `# Title

\`\`\`
# Ignored
\`\`\`

## Real Section`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings).toHaveLength(1);
      expect(headings[0].children).toHaveLength(1);
      expect(headings[0].children![0].text).toBe("Real Section");
    });
  });

  describe("Hierarchy building", () => {
    it("should build correct hierarchy", () => {
      const content = `# Chapter 1
## Section 1.1
### Subsection 1.1.1
## Section 1.2
# Chapter 2
## Section 2.1`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings).toHaveLength(2);

      // Chapter 1 structure
      const chapter1 = headings[0];
      expect(chapter1.text).toBe("Chapter 1");
      expect(chapter1.children).toHaveLength(2);
      expect(chapter1.children![0].text).toBe("Section 1.1");
      expect(chapter1.children![0].children).toHaveLength(1);
      expect(chapter1.children![0].children![0].text).toBe("Subsection 1.1.1");
      expect(chapter1.children![1].text).toBe("Section 1.2");

      // Chapter 2 structure
      const chapter2 = headings[1];
      expect(chapter2.text).toBe("Chapter 2");
      expect(chapter2.children).toHaveLength(1);
      expect(chapter2.children![0].text).toBe("Section 2.1");
    });

    it("should handle non-sequential heading levels", () => {
      const content = `# Title
##### Deep Heading
## Back to Level 2`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      // Non-sequential levels should still nest properly
      expect(headings).toHaveLength(1);
      expect(headings[0].children).toHaveLength(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty content", () => {
      const { result } = renderHook(() => useHeadingExtraction(""));
      expect(result.current).toEqual([]);
    });

    it("should handle content with no headings", () => {
      const content = `Just some regular text
with multiple lines
but no headings`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      expect(result.current).toEqual([]);
    });

    it("should handle headings with inline code", () => {
      const content = `# Install \`npm\`
## Setup \`package.json\``;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].text).toBe("Install `npm`");
      expect(headings[0].id).toBe("heading-install-npm");
    });

    it("should ignore lines that look like headings but aren't", () => {
      const content = `# Real Heading
Not a heading # with hash at end
## Real Heading 2`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings).toHaveLength(1);
      expect(headings[0].children).toHaveLength(1);
    });

    it("should handle very long heading text", () => {
      const longText = "A".repeat(200);
      const content = `# ${longText}`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].text).toBe(longText);
      expect(headings[0].id.length).toBeGreaterThan(0);
    });

    it("should update when content changes", () => {
      const { result, rerender } = renderHook(({ content }) => useHeadingExtraction(content), {
        initialProps: { content: "# Initial" },
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].text).toBe("Initial");

      rerender({ content: "# Updated\n## Subheading" });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].text).toBe("Updated");
      expect(result.current[0].children).toHaveLength(1);
    });
  });

  describe("Real-world content", () => {
    it("should extract from typical markdown document", () => {
      const content = `# Getting Started with TypeScript

TypeScript adds static typing to JavaScript.

## Why TypeScript?

- Better IDE support
- Catch bugs early

## Quick Setup

\`\`\`bash
npm install typescript
\`\`\`

### Creating your first type

\`\`\`typescript
interface User {
  name: string;
  age: number;
}
\`\`\`

## Advanced Usage

### Generics

### Decorators`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].text).toBe("Getting Started with TypeScript");
      expect(headings[0].children).toHaveLength(3);

      const whyTS = headings[0].children![0];
      expect(whyTS.text).toBe("Why TypeScript?");
      expect(whyTS.children).toBeUndefined();

      const setup = headings[0].children![1];
      expect(setup.text).toBe("Quick Setup");
      expect(setup.children).toHaveLength(1);
      expect(setup.children![0].text).toBe("Creating your first type");

      const advanced = headings[0].children![2];
      expect(advanced.text).toBe("Advanced Usage");
      expect(advanced.children).toHaveLength(2);
      expect(advanced.children![0].text).toBe("Generics");
      expect(advanced.children![1].text).toBe("Decorators");
    });
  });

  describe("Multiple h1 levels", () => {
    it("should handle multiple top-level headings", () => {
      const content = `# Chapter 1
## Section 1.1
# Chapter 2
## Section 2.1
# Chapter 3`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings).toHaveLength(3);
      expect(headings[0].text).toBe("Chapter 1");
      expect(headings[1].text).toBe("Chapter 2");
      expect(headings[2].text).toBe("Chapter 3");
    });
  });

  describe("Duplicate handling across hierarchy", () => {
    it("should generate unique IDs for duplicate names at different levels", () => {
      const content = `# Intro
## Getting Started
# Guide
## Getting Started
## Getting Started
# Reference
## Getting Started`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      const allHeadings = flattenHeadings(headings);
      const gettingStartedIds = allHeadings
        .filter((h) => h.text === "Getting Started")
        .map((h) => h.id);

      expect(new Set(gettingStartedIds).size).toBe(gettingStartedIds.length); // All unique
      expect(gettingStartedIds[0]).toBe("heading-getting-started");
      expect(gettingStartedIds[1]).toBe("heading-getting-started-2");
      expect(gettingStartedIds[2]).toBe("heading-getting-started-3");
    });
  });

  describe("Empty and whitespace-only content", () => {
    it("should handle whitespace-only content", () => {
      const { result } = renderHook(() => useHeadingExtraction("   \n  \n   "));
      expect(result.current).toEqual([]);
    });

    it("should handle single newlines", () => {
      const { result } = renderHook(() => useHeadingExtraction("\n"));
      expect(result.current).toEqual([]);
    });
  });

  describe("Slug generation edge cases", () => {
    it("should handle headings with only special characters", () => {
      const content = `# !!!%%%
## ###$$$`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].id).toBe("heading-");
      expect(headings[0].children![0].id).toBe("heading--2");
    });

    it("should handle unicode characters", () => {
      const content = `# Héllo Wörld
## Über Advanced`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].text).toBe("Héllo Wörld");
      expect(headings[0].children![0].text).toBe("Über Advanced");
    });

    it("should collapse multiple spaces into single hyphen", () => {
      const content = `# Multiple    Spaces    Here`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].id).toBe("heading-multiple-spaces-here");
    });
  });

  describe("Line number accuracy", () => {
    it("should track correct line numbers for all headings", () => {
      const content = `Line 0
# Heading at line 1
Line 2
Line 3
## Subheading at line 4
Line 5
### Sub-subheading at line 6`;

      const { result } = renderHook(() => useHeadingExtraction(content));
      const headings = result.current;

      expect(headings[0].lineNumber).toBe(1);
      expect(headings[0].children![0].lineNumber).toBe(4);
      expect(headings[0].children![0].children![0].lineNumber).toBe(6);
    });
  });
});

interface FlatHeading {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  lineNumber: number;
  children?: FlatHeading[];
}

function flattenHeadings(headings: FlatHeading[]): FlatHeading[] {
  const result: FlatHeading[] = [];
  function traverse(items: FlatHeading[]) {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        traverse(item.children);
      }
    }
  }
  traverse(headings);
  return result;
}
