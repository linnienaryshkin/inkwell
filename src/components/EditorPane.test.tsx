import { render, screen, fireEvent } from "@testing-library/react";
import { EditorPane } from "./EditorPane";
import type { Article } from "@/app/studio/page";

// Mock react-markdown and remark-gfm: next/jest prepends a blanket /node_modules/
// ignore pattern that prevents ESM packages from being transformed.
jest.mock("react-markdown", () => {
  return function DummyMarkdown(props: {
    children: string;
    components?: { code: (props: { className: string; children: string }) => React.ReactNode };
  }) {
    const { children, components } = props;
    const content = children as string;

    // Simulate basic markdown parsing with code fence detection
    if (content.includes("```mermaid") && components?.code) {
      // Extract all mermaid code blocks and call the code component renderer for each
      const mermaidMatches = content.matchAll(/```mermaid\n([\s\S]*?)\n```/g);
      const rendered = [];

      for (const match of mermaidMatches) {
        const code = match[1];
        rendered.push(
          components.code({
            className: "language-mermaid",
            children: code,
          })
        );
      }

      if (rendered.length > 0) {
        return <div data-testid="markdown-preview">{rendered}</div>;
      }
    }

    return <div data-testid="markdown-preview">{children}</div>;
  };
});

jest.mock("remark-gfm", () => ({}));

// Mock MermaidBlock component
jest.mock("./MermaidBlock", () => ({
  MermaidBlock: ({ code }: { code: string }) => (
    <div data-testid="mermaid-block" data-code={code}>
      Mermaid Diagram
    </div>
  ),
}));

// Mock Monaco Editor — it's lazy-loaded via React.lazy
jest.mock("@monaco-editor/react", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ value, onChange, ...editorProps }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      {...editorProps}
    />
  ),
}));

describe("EditorPane", () => {
  const mockArticle: Article = {
    slug: "markdown-guide",
    title: "Markdown Guide",
    status: "draft",
    content: "# Introduction\n\nMarkdown is a lightweight markup language.",
    tags: ["markdown", "documentation"],
  };

  describe("Display", () => {
    it("should display article title in header", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      expect(screen.getByText("Markdown Guide")).toBeInTheDocument();
    });

    it("should display content.md filename", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      expect(screen.getByText("content.md")).toBeInTheDocument();
    });

    it("should display all article tags", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      expect(screen.getByText("markdown")).toBeInTheDocument();
      expect(screen.getByText("documentation")).toBeInTheDocument();
    });

    it("should show the preview toggle button", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      expect(toggleButton).toBeInTheDocument();
    });

    it("should start in edit mode with editor visible", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const editor = screen.getByTestId("monaco-editor");
      expect(editor).toBeVisible();
    });
  });

  describe("Edit mode functionality", () => {
    it("should display article content in editor", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement;
      expect(editor.value).toBe(mockArticle.content);
    });

    it("should call onChange when content is edited", () => {
      const handleChange = jest.fn();
      render(<EditorPane article={mockArticle} onChange={handleChange} />);

      const editor = screen.getByTestId("monaco-editor");
      fireEvent.change(editor, { target: { value: "# New Content" } });

      expect(handleChange).toHaveBeenCalledWith("# New Content");
    });

    it("should allow multiple sequential edits", () => {
      const handleChange = jest.fn();
      render(<EditorPane article={mockArticle} onChange={handleChange} />);

      const editor = screen.getByTestId("monaco-editor");

      fireEvent.change(editor, { target: { value: "# First edit" } });
      fireEvent.change(editor, { target: { value: "# First edit\n\nAdded paragraph" } });
      fireEvent.change(editor, { target: { value: "# Final content" } });

      expect(handleChange).toHaveBeenCalledTimes(3);
      expect(handleChange).toHaveBeenLastCalledWith("# Final content");
    });
  });

  describe("Preview mode toggle", () => {
    it("should toggle to preview mode when button is clicked", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      expect(screen.getByTitle("Switch to editor")).toBeInTheDocument();
    });

    it("should hide editor in preview mode", () => {
      const { container } = render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      const editorContainer = container.querySelector('[style*="display: none"]');
      expect(editorContainer).toBeInTheDocument();
    });

    it("should toggle back to edit mode", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");

      fireEvent.click(toggleButton); // Switch to preview
      fireEvent.click(screen.getByTitle("Switch to editor")); // Switch back

      expect(screen.getByTitle("Switch to preview")).toBeInTheDocument();
    });

    it("should display markdown content in preview mode", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      // The preview container should be visible with the markdown content
      const preview = screen.getByTestId("markdown-preview");
      expect(preview).toBeVisible();
      expect(preview.textContent).toContain("Introduction");
    });

    it("should maintain content when switching modes", () => {
      const handleChange = jest.fn();
      render(<EditorPane article={mockArticle} onChange={handleChange} />);

      const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement;
      const originalContent = editor.value;

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByTitle("Switch to editor"));

      expect(editor.value).toBe(originalContent);
    });
  });

  describe("Markdown support", () => {
    it("should display markdown with various formatting", () => {
      const articleWithFormatting: Article = {
        ...mockArticle,
        content: "# Heading\n\n**Bold** and *italic*\n\n- Item 1\n- Item 2",
      };

      render(<EditorPane article={articleWithFormatting} onChange={() => {}} />);

      const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement;
      expect(editor.value).toContain("# Heading");
      expect(editor.value).toContain("**Bold**");
      expect(editor.value).toContain("*italic*");
    });

    it("should preserve code blocks in content", () => {
      const articleWithCode: Article = {
        ...mockArticle,
        content: '```javascript\nconst greeting = "Hello";\n```',
      };

      render(<EditorPane article={articleWithCode} onChange={() => {}} />);

      const editor = screen.getByTestId("monaco-editor") as HTMLTextAreaElement;
      expect(editor.value).toContain("javascript");
      expect(editor.value).toContain("const greeting");
    });

    it("should support GitHub flavored markdown (GFM)", () => {
      const articleWithGfm: Article = {
        ...mockArticle,
        content: "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |",
      };

      render(<EditorPane article={articleWithGfm} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      // The preview container should be visible with the GFM content
      const preview = screen.getByTestId("markdown-preview");
      expect(preview).toBeVisible();
      expect(preview.textContent).toContain("Header 1");
      expect(preview.textContent).toContain("Cell 1");
    });
  });

  describe("Tags display", () => {
    it("should display tags with appropriate styling", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const tags = screen.getAllByText(/markdown|documentation/);
      expect(tags).toHaveLength(2);
    });

    it("should handle articles with multiple tags", () => {
      const articleWithMoreTags: Article = {
        ...mockArticle,
        tags: ["typescript", "react", "testing", "jest"],
      };

      render(<EditorPane article={articleWithMoreTags} onChange={() => {}} />);

      expect(screen.getByText("typescript")).toBeInTheDocument();
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("testing")).toBeInTheDocument();
      expect(screen.getByText("jest")).toBeInTheDocument();
    });

    it("should handle articles with no tags", () => {
      const articleWithoutTags: Article = {
        ...mockArticle,
        tags: [],
      };

      render(<EditorPane article={articleWithoutTags} onChange={() => {}} />);

      expect(screen.getByText("Markdown Guide")).toBeInTheDocument();
    });
  });

  describe("Theme prop", () => {
    it("should render with dark theme by default", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);
      const editor = screen.getByTestId("monaco-editor");
      expect(editor).toBeInTheDocument();
    });

    it("should accept a light theme prop", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} theme="light" />);
      const editor = screen.getByTestId("monaco-editor");
      expect(editor).toBeInTheDocument();
    });
  });

  describe("Status bar", () => {
    it("should display word count for article content", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      expect(screen.getByTestId("status-bar")).toBeInTheDocument();
    });

    it("should display reading time for article content", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      const statusBar = screen.getByTestId("status-bar");
      expect(statusBar.textContent).toMatch(/min read/);
    });

    it("should show correct word count", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      // mockArticle content has 8 words: "# Introduction\n\nMarkdown is a lightweight markup language."
      const statusBar = screen.getByTestId("status-bar");
      expect(statusBar.textContent).toContain("8");
      expect(statusBar.textContent).toContain("words");
    });

    it("should show 1 min read for short content", () => {
      const shortArticle: Article = {
        ...mockArticle,
        content: "Short text",
      };

      render(<EditorPane article={shortArticle} onChange={() => {}} />);

      const statusBar = screen.getByTestId("status-bar");
      expect(statusBar.textContent).toContain("2 words");
      expect(statusBar.textContent).toContain("1 min read");
    });

    it("should show 0 words for empty content", () => {
      const emptyArticle: Article = {
        ...mockArticle,
        content: "",
      };

      render(<EditorPane article={emptyArticle} onChange={() => {}} />);

      const statusBar = screen.getByTestId("status-bar");
      expect(statusBar.textContent).toContain("0 words");
      expect(statusBar.textContent).toContain("1 min read");
    });

    it("should update word count when content changes", () => {
      const { rerender } = render(<EditorPane article={mockArticle} onChange={() => {}} />);

      // mockArticle has 8 words
      let statusBar = screen.getByTestId("status-bar");
      expect(statusBar.textContent).toContain("8");

      const longArticle: Article = {
        ...mockArticle,
        content:
          "This is a much longer article with many more words that should increase the word count significantly beyond the original short content.",
      };

      rerender(<EditorPane article={longArticle} onChange={() => {}} />);

      // longArticle has 22 words
      statusBar = screen.getByTestId("status-bar");
      expect(statusBar.textContent).toContain("22");
    });

    it("should display status bar in both edit and preview modes", () => {
      render(<EditorPane article={mockArticle} onChange={() => {}} />);

      // Check in edit mode
      const statusBar = screen.getByTestId("status-bar");
      expect(statusBar).toBeVisible();

      // Switch to preview mode
      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      // Check in preview mode
      expect(statusBar).toBeVisible();
    });

    it("should handle articles with multiple newlines and whitespace", () => {
      const articleWithWhitespace: Article = {
        ...mockArticle,
        content: "Word1\n\n\n\nWord2   Word3\t\tWord4",
      };

      render(<EditorPane article={articleWithWhitespace} onChange={() => {}} />);

      const statusBar = screen.getByTestId("status-bar");
      expect(statusBar.textContent).toContain("4 words");
    });
  });

  describe("Mermaid diagram support", () => {
    it("should render MermaidBlock for code fences with language-mermaid", () => {
      const articleWithMermaid: Article = {
        ...mockArticle,
        content: "# Diagram\n\n```mermaid\ngraph TD\n  A[Start]\n```",
      };

      render(<EditorPane article={articleWithMermaid} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      // The MermaidBlock component should be rendered
      expect(screen.getByTestId("mermaid-block")).toBeInTheDocument();
    });

    it("should render plain code block for non-mermaid code fences", () => {
      const articleWithCode: Article = {
        ...mockArticle,
        content: "# Code\n\n```javascript\nconst x = 1;\n```",
      };

      render(<EditorPane article={articleWithCode} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      const preview = screen.getByTestId("markdown-preview");
      expect(preview).toBeInTheDocument();
    });

    it("should pass trimmed code to MermaidBlock", () => {
      const articleWithMermaid: Article = {
        ...mockArticle,
        content: "# Diagram\n\n```mermaid\n  graph TD\n    A[Start]\n  \n```",
      };

      render(<EditorPane article={articleWithMermaid} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      const mermaidBlock = screen.getByTestId("mermaid-block");
      expect(mermaidBlock).toHaveAttribute("data-code", expect.stringContaining("graph TD"));
    });

    it("should handle multiple mermaid diagrams on the same page", () => {
      const articleWithMultipleDiagrams: Article = {
        ...mockArticle,
        content:
          "# Diagrams\n\n```mermaid\ngraph TD\n  A[Start]\n```\n\nSome text\n\n```mermaid\nflowchart LR\n  B[End]\n```",
      };

      render(<EditorPane article={articleWithMultipleDiagrams} onChange={() => {}} />);

      const toggleButton = screen.getByTitle("Switch to preview");
      fireEvent.click(toggleButton);

      // Both mermaid blocks should be rendered
      const mermaidBlocks = screen.getAllByTestId("mermaid-block");
      expect(mermaidBlocks).toHaveLength(2);
    });
  });
});
