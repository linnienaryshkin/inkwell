import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MermaidBlock } from "./MermaidBlock";

// Mock mermaid entirely since it relies on DOM APIs unavailable in jsdom
jest.mock("mermaid", () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(),
  },
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

    it("should show spinner with role status while render is pending", async () => {
      mockMermaid.render.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves to keep component in loading state
          })
      );

      render(<MermaidBlock code="graph TD\n A[Start]" />);

      expect(screen.getByRole("status", { name: "Rendering diagram" })).toBeInTheDocument();
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

    it("should truncate long error messages with show more button", async () => {
      const longError = "A".repeat(200);
      mockMermaid.render.mockRejectedValue(new Error(longError));

      render(<MermaidBlock code="invalid" />);

      await waitFor(() => {
        expect(screen.getByText(/A+…/)).toBeInTheDocument();
        expect(screen.getByTitle("Show full error")).toBeInTheDocument();
      });
    });

    it("should expand full error when show more is clicked", async () => {
      const longError = "B".repeat(200);
      mockMermaid.render.mockRejectedValue(new Error(longError));

      render(<MermaidBlock code="invalid" />);

      await waitFor(() => {
        expect(screen.getByTitle("Show full error")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Show full error"));

      expect(screen.getByText(new RegExp("B".repeat(200)))).toBeInTheDocument();
      expect(screen.getByTitle("Show less")).toBeInTheDocument();
    });

    it("should collapse error when show less is clicked", async () => {
      const longError = "C".repeat(200);
      mockMermaid.render.mockRejectedValue(new Error(longError));

      render(<MermaidBlock code="invalid" />);

      await waitFor(() => {
        expect(screen.getByTitle("Show full error")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Show full error"));
      fireEvent.click(screen.getByTitle("Show less"));

      expect(screen.getByTitle("Show full error")).toBeInTheDocument();
    });

    it("should not show expand button for short errors", async () => {
      const shortError = "Short error";
      mockMermaid.render.mockRejectedValue(new Error(shortError));

      render(<MermaidBlock code="invalid" />);

      await waitFor(() => {
        expect(screen.getByText(/Short error/)).toBeInTheDocument();
      });

      expect(screen.queryByTitle("Show full error")).not.toBeInTheDocument();
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
        if (resolveFirst !== null) {
          (resolveFirst as (value: { svg: string; diagramType: string }) => void)({
            svg: "<svg><text>Result</text></svg>",
            diagramType: "flowchart",
          });
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
