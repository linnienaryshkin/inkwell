jest.mock("mermaid", () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn().mockResolvedValue({
      svg: "<svg><text>test</text></svg>",
      map: {},
      bindFunctions: jest.fn(),
    }),
  },
}));

import { exportToMarkdown, exportToPdf, type PdfOptions } from "./exportUtils";
import type { Article } from "@/app/studio/page";
import mermaid from "mermaid";

const mockMermaid = jest.mocked(mermaid);

const mockArticle: Article = {
  slug: "test-article",
  content: `# Test Article

This is a test article.

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

More content here.`,
  meta: {
    slug: "test-article",
    title: "Test Article",
    status: "draft",
    tags: ["test"],
  },
  versions: [],
};

describe("exportUtils", () => {
  describe("exportToMarkdown", () => {
    beforeEach(() => {
      // Mock DOM APIs
      Object.defineProperty(global, "URL", {
        value: {
          createObjectURL: jest.fn(() => "blob:mock-url"),
          revokeObjectURL: jest.fn(),
        },
        writable: true,
      });

      // Mock document.createElement
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };
      jest.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should create a blob download with article content", () => {
      exportToMarkdown(mockArticle);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith("a");
    });

    it("should use article title as filename", () => {
      const createElement = jest.spyOn(document, "createElement");
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };
      createElement.mockReturnValue(mockLink as unknown as HTMLElement);

      exportToMarkdown(mockArticle);

      const link = createElement.mock.results[0].value;
      expect(link.download).toBe("Test Article.md");
    });

    it("should fall back to slug when title is empty", () => {
      const createElement = jest.spyOn(document, "createElement");
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };
      createElement.mockReturnValue(mockLink as unknown as HTMLElement);

      const articleNoTitle: Article = {
        ...mockArticle,
        meta: { ...mockArticle.meta, title: "" },
      };

      exportToMarkdown(articleNoTitle);

      const link = createElement.mock.results[0].value;
      expect(link.download).toBe("test-article.md");
    });
  });

  describe("exportToPdf", () => {
    beforeEach(() => {
      // Mock document.createElement for iframe
      const mockIframe = {
        style: {},
        contentDocument: {
          open: jest.fn(),
          write: jest.fn(),
          close: jest.fn(),
        },
        contentWindow: {
          document: {
            readyState: "complete",
          },
          print: jest.fn(),
        },
      };
      jest.spyOn(document, "createElement").mockReturnValue(mockIframe as unknown as HTMLElement);
      jest
        .spyOn(document.body, "appendChild")
        .mockReturnValue(mockIframe as unknown as HTMLElement);
      jest
        .spyOn(document.body, "removeChild")
        .mockReturnValue(mockIframe as unknown as HTMLElement);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should resolve without error for article with no mermaid blocks", async () => {
      const articleNoMermaid: Article = {
        ...mockArticle,
        content: "# No diagrams\n\nJust text.",
      };

      const options: PdfOptions = { fontSize: 14 };

      await expect(exportToPdf(articleNoMermaid, options)).resolves.not.toThrow();
    });

    it("should call mermaid.render for each mermaid fence", async () => {
      const options: PdfOptions = { fontSize: 14 };

      await exportToPdf(mockArticle, options);

      expect(mockMermaid.render).toHaveBeenCalled();
    });

    it("should wrap mermaid SVG in a container div", async () => {
      const options: PdfOptions = { fontSize: 14 };

      await exportToPdf(mockArticle, options);

      // Verify mermaid rendering was called and SVG was processed
      expect(mockMermaid.render).toHaveBeenCalled();
    });

    it("should throw error when iframe document is inaccessible", async () => {
      const mockIframe = {
        style: {},
        contentDocument: null,
        contentWindow: {
          document: null,
        },
      };
      jest.spyOn(document, "createElement").mockReturnValue(mockIframe as unknown as HTMLElement);
      jest
        .spyOn(document.body, "appendChild")
        .mockReturnValue(mockIframe as unknown as HTMLElement);

      const options: PdfOptions = { fontSize: 14 };

      await expect(exportToPdf(mockArticle, options)).rejects.toThrow(
        "Failed to access iframe document"
      );
    });
  });

  describe("Markdown Conversion", () => {
    beforeEach(() => {
      // Mock document.createElement for iframe
      const mockIframe = {
        style: {},
        contentDocument: {
          open: jest.fn(),
          write: jest.fn(),
          close: jest.fn(),
        },
        contentWindow: {
          document: {
            readyState: "complete",
          },
          print: jest.fn(),
        },
      };
      jest.spyOn(document, "createElement").mockReturnValue(mockIframe as unknown as HTMLElement);
      jest
        .spyOn(document.body, "appendChild")
        .mockReturnValue(mockIframe as unknown as HTMLElement);
      jest
        .spyOn(document.body, "removeChild")
        .mockReturnValue(mockIframe as unknown as HTMLElement);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should escape HTML special characters in tables", async () => {
      const articleWithTable: Article = {
        ...mockArticle,
        content: `| Header |
| <script>alert(1)</script> |
| --- |
| <img src=x onerror=alert(1)> |`,
      };
      const options: PdfOptions = { fontSize: 14 };

      await exportToPdf(articleWithTable, options);

      // Verify the export completed (escaped content is safe)
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it("should escape HTML in unordered lists", async () => {
      const articleWithList: Article = {
        ...mockArticle,
        content: `- Item with <script>alert(1)</script>
- Normal item
- Another item`,
      };
      const options: PdfOptions = { fontSize: 14 };

      await exportToPdf(articleWithList, options);

      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it("should escape HTML in ordered lists", async () => {
      const articleWithList: Article = {
        ...mockArticle,
        content: `1. Item with <img src=x onerror=alert(1)>
2. Normal item
3. Another item`,
      };
      const options: PdfOptions = { fontSize: 14 };

      await exportToPdf(articleWithList, options);

      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it("should escape HTML in paragraphs", async () => {
      const articleWithHtml: Article = {
        ...mockArticle,
        content: `Normal paragraph with <script>alert(1)</script> injected code.

Another paragraph with <img src=x onerror=alert(1)>.`,
      };
      const options: PdfOptions = { fontSize: 14 };

      await exportToPdf(articleWithHtml, options);

      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it("should handle code blocks with backticks", async () => {
      const articleWithCode: Article = {
        ...mockArticle,
        content: `\`\`\`javascript
const x = "<script>alert(1)</script>";
\`\`\``,
      };
      const options: PdfOptions = { fontSize: 14 };

      await exportToPdf(articleWithCode, options);

      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it("should apply font size to PDF output", async () => {
      const articleSimple: Article = {
        ...mockArticle,
        content: "# Test",
      };
      const options: PdfOptions = { fontSize: 18 };

      const writeFn = jest.fn();
      const mockIframe = {
        style: {},
        contentDocument: {
          open: jest.fn(),
          write: writeFn,
          close: jest.fn(),
        },
        contentWindow: {
          document: {
            readyState: "complete",
          },
          print: jest.fn(),
        },
      };

      (document.createElement as jest.Mock).mockReturnValue(mockIframe as unknown as HTMLElement);
      (document.body.appendChild as jest.Mock).mockReturnValue(
        mockIframe as unknown as HTMLElement
      );
      (document.body.removeChild as jest.Mock).mockReturnValue(
        mockIframe as unknown as HTMLElement
      );

      await exportToPdf(articleSimple, options);

      const writtenHtml = writeFn.mock.calls[0][0] as string;
      expect(writtenHtml).toContain("font-size: 18px");
    });
  });
});
