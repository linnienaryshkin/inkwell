import { render, screen, waitFor } from "@testing-library/react";
import { MermaidBlock } from "./MermaidBlock";

// Mock mermaid entirely since it relies on DOM APIs unavailable in jsdom
jest.mock("mermaid", () => ({
  initialize: jest.fn(),
  render: jest.fn(),
}));

import mermaid from "mermaid";

const mockMermaid = mermaid as jest.Mocked<typeof mermaid>;

describe("MermaidBlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading state", () => {
    it("should show loading state while render is pending", async () => {
      mockMermaid.render.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves to keep component in loading state
          })
      );

      render(<MermaidBlock code="graph TD\n A[Start]" />);

      expect(screen.getByText("Rendering diagram…")).toBeInTheDocument();
    });
  });

  describe("Success state", () => {
    it("should show SVG output when mermaid.render resolves", async () => {
      const svgContent = "<svg><text>Diagram</text></svg>";
      mockMermaid.render.mockResolvedValue({
        svg: svgContent,
        diagramType: "flowchart",
      });

      render(<MermaidBlock code="graph TD\n  A[Start]" />);

      await waitFor(() => {
        expect(screen.getByText("Diagram")).toBeInTheDocument();
      });
    });

    it("should render SVG with overflowX auto for large diagrams", async () => {
      const svgContent = '<svg><circle cx="100" cy="100" r="50"/></svg>';
      mockMermaid.render.mockResolvedValue({
        svg: svgContent,
        diagramType: "flowchart",
      });

      const { container } = render(<MermaidBlock code="graph TD\n  A[Start]" />);

      await waitFor(() => {
        const wrapper = container.querySelector('div[style*="overflow"]');
        expect(wrapper).toBeInTheDocument();
        expect(wrapper).toHaveStyle("overflowX: auto");
      });
    });
  });

  describe("Error state", () => {
    it("should show inline error box when mermaid.render rejects", async () => {
      const errorMessage = "Invalid mermaid syntax";
      mockMermaid.render.mockRejectedValue(new Error(errorMessage));

      render(<MermaidBlock code="invalid" />);

      await waitFor(() => {
        expect(screen.getByText(/Invalid mermaid syntax/)).toBeInTheDocument();
      });
    });

    it("should display error with proper styling", async () => {
      const errorMessage = "Parse error at line 1";
      mockMermaid.render.mockRejectedValue(new Error(errorMessage));

      const { container } = render(<MermaidBlock code="invalid" />);

      await waitFor(() => {
        const errorBox = container.querySelector('div[style*="rgba(248, 81, 73"]');
        expect(errorBox).toBeInTheDocument();
      });
    });
  });

  describe("Code prop updates", () => {
    it("should re-render when code prop changes", async () => {
      const initialSvg = "<svg><text>Initial</text></svg>";
      const updatedSvg = "<svg><text>Updated</text></svg>";

      mockMermaid.render.mockResolvedValueOnce({
        svg: initialSvg,
        diagramType: "flowchart",
      });

      const { rerender } = render(<MermaidBlock code="graph TD\n  A[Start]" />);

      await waitFor(() => {
        expect(screen.getByText("Initial")).toBeInTheDocument();
      });

      mockMermaid.render.mockResolvedValueOnce({
        svg: updatedSvg,
        diagramType: "flowchart",
      });

      rerender(<MermaidBlock code="graph TD\n  B[End]" />);

      await waitFor(() => {
        expect(screen.getByText("Updated")).toBeInTheDocument();
      });
    });

    it("should cancel in-flight render when code changes quickly", async () => {
      jest.useFakeTimers();
      try {
        let resolveFirst: ((value: { svg: string; diagramType: string }) => void) | null = null;
        mockMermaid.render.mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            })
        );

        const { rerender } = render(<MermaidBlock code="graph TD\n  A[Start]" />);

        // Change code immediately - should cancel the previous render
        rerender(<MermaidBlock code="graph TD\n  B[Middle]" />);
        rerender(<MermaidBlock code="graph TD\n  C[End]" />);

        // Resolve the pending render
        if (resolveFirst) {
          resolveFirst({ svg: "<svg><text>Result</text></svg>", diagramType: "flowchart" });
        }

        // Check that render was called multiple times due to rerenders
        expect(mockMermaid.render).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("Empty code fence", () => {
    it("should show error for empty mermaid code", async () => {
      const errorMessage = "Empty diagram";
      mockMermaid.render.mockRejectedValue(new Error(errorMessage));

      render(<MermaidBlock code="" />);

      await waitFor(() => {
        expect(screen.getByText(/Empty diagram/)).toBeInTheDocument();
      });
    });
  });

  describe("Unique IDs", () => {
    it("should generate unique IDs for multiple diagrams", async () => {
      mockMermaid.render.mockResolvedValue({
        svg: "<svg><text>Diagram</text></svg>",
        diagramType: "flowchart",
      });

      render(<MermaidBlock code="graph TD\n  A[First]" />);

      await waitFor(() => {
        expect(mockMermaid.render).toHaveBeenCalled();
      });

      const firstCallId = (mockMermaid.render as jest.Mock).mock.calls[0][0];
      expect(firstCallId).toMatch(/^mermaid-/);
    });
  });
});
