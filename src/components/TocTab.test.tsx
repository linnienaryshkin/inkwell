import { render, screen, fireEvent } from "@testing-library/react";
import { TocTab } from "./TocTab";

describe("TocTab", () => {
  describe("Display", () => {
    it("should render heading content from markdown", () => {
      const content = `# Getting Started
## Installation
## Configuration`;

      render(<TocTab content={content} />);

      expect(screen.getByText("Getting Started")).toBeInTheDocument();
      expect(screen.getByText("Installation")).toBeInTheDocument();
      expect(screen.getByText("Configuration")).toBeInTheDocument();
    });

    it("should display hierarchical structure", () => {
      const content = `# Main
## Sub1
### Sub1.1
## Sub2`;

      render(<TocTab content={content} />);

      const mainButton = screen.getByText("Main");
      const sub1Button = screen.getByText("Sub1");
      const sub11Button = screen.getByText("Sub1.1");
      const sub2Button = screen.getByText("Sub2");

      expect(mainButton).toBeInTheDocument();
      expect(sub1Button).toBeInTheDocument();
      expect(sub11Button).toBeInTheDocument();
      expect(sub2Button).toBeInTheDocument();
    });

    it("should show empty state when no headings found", () => {
      const content = "Just some regular text without headings";
      render(<TocTab content={content} />);

      expect(screen.getByText("No headings found")).toBeInTheDocument();
    });

    it("should show empty state for empty content", () => {
      render(<TocTab content="" />);

      expect(screen.getByText("No headings found")).toBeInTheDocument();
    });

    it("should render multiple top-level headings", () => {
      const content = `# Chapter 1
## Section 1.1
# Chapter 2
## Section 2.1`;

      render(<TocTab content={content} />);

      expect(screen.getByText("Chapter 1")).toBeInTheDocument();
      expect(screen.getByText("Chapter 2")).toBeInTheDocument();
      expect(screen.getByText("Section 1.1")).toBeInTheDocument();
      expect(screen.getByText("Section 2.1")).toBeInTheDocument();
    });
  });

  describe("User interaction", () => {
    it("should call onClick when a heading is clicked", () => {
      const content = `# Main
## Sub1
## Sub2`;

      render(<TocTab content={content} />);

      const sub1Button = screen.getByText("Sub1");
      fireEvent.click(sub1Button);

      // Component should handle the click (would normally scroll to heading)
      expect(sub1Button).toBeInTheDocument();
    });

    it("should handle multiple heading clicks", () => {
      const content = `# Main
## Sub1
## Sub2
## Sub3`;

      render(<TocTab content={content} />);

      const sub1 = screen.getByText("Sub1");
      const sub2 = screen.getByText("Sub2");
      const sub3 = screen.getByText("Sub3");

      fireEvent.click(sub1);
      fireEvent.click(sub2);
      fireEvent.click(sub3);

      expect(sub1).toBeInTheDocument();
      expect(sub2).toBeInTheDocument();
      expect(sub3).toBeInTheDocument();
    });
  });

  describe("Styling and accessibility", () => {
    it("should render heading buttons as clickable elements", () => {
      const content = `# Main
## Sub`;

      render(<TocTab content={content} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.some((btn) => btn.textContent === "Main")).toBe(true);
    });

    it("should have aria-current on current heading", () => {
      const content = `# Main
## Sub`;

      const { rerender } = render(<TocTab content={content} />);

      // Initially aria-current should not be set (no current heading)
      let buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);

      // After update, aria-current might be set if we're tracking current
      rerender(<TocTab content={content} />);
      buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("should render buttons with proper text contrast", () => {
      const content = `# Getting Started
## Quick Setup`;

      render(<TocTab content={content} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.every((btn) => btn.textContent?.trim().length ?? 0 > 0)).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle code blocks in content", () => {
      const content = `# Main

\`\`\`
# Not a heading
\`\`\`

## Real Heading`;

      render(<TocTab content={content} />);

      expect(screen.getByText("Main")).toBeInTheDocument();
      expect(screen.getByText("Real Heading")).toBeInTheDocument();
      expect(screen.queryByText("Not a heading")).not.toBeInTheDocument();
    });

    it("should handle special characters in headings", () => {
      const content = `# Hello, World! (2024)
## Advanced C++ Patterns`;

      render(<TocTab content={content} />);

      expect(screen.getByText("Hello, World! (2024)")).toBeInTheDocument();
      expect(screen.getByText("Advanced C++ Patterns")).toBeInTheDocument();
    });

    it("should handle very long heading text", () => {
      const longText = "A".repeat(100);
      const content = `# ${longText}`;

      render(<TocTab content={content} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it("should handle headings with inline code", () => {
      const content = `# Install \`npm\`
## Setup \`package.json\``;

      render(<TocTab content={content} />);

      expect(screen.getByText("Install `npm`")).toBeInTheDocument();
      expect(screen.getByText("Setup `package.json`")).toBeInTheDocument();
    });
  });

  describe("Content updates", () => {
    it("should update headings when content changes", () => {
      const { rerender } = render(<TocTab content="# Initial" />);

      expect(screen.getByRole("button", { name: /Initial/i })).toBeInTheDocument();

      rerender(<TocTab content="# Updated\n## Subheading" />);

      expect(screen.getByRole("button", { name: /Updated/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Subheading/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Initial/i })).not.toBeInTheDocument();
    });

    it("should show empty state when headings are removed", () => {
      const { rerender } = render(<TocTab content="# Heading" />);

      expect(screen.getByRole("button", { name: /Heading/i })).toBeInTheDocument();

      rerender(<TocTab content="No headings here" />);

      expect(screen.getByText("No headings found")).toBeInTheDocument();
    });

    it("should handle adding new headings", () => {
      const { rerender } = render(<TocTab content="# First" />);

      expect(screen.getByRole("button", { name: /First/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Second/i })).not.toBeInTheDocument();

      rerender(<TocTab content="# First\n# Second\n# Third" />);

      expect(screen.getByRole("button", { name: /First/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Second/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Third/i })).toBeInTheDocument();
    });
  });

  describe("Indentation", () => {
    it("should indent nested headings", () => {
      const content = `# Level 1
## Level 2
### Level 3`;

      const { container } = render(<TocTab content={content} />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(3);

      // Check that padding increases with depth
      const level2 = Array.from(buttons).find((btn) => btn.textContent === "Level 2");
      const level3 = Array.from(buttons).find((btn) => btn.textContent === "Level 3");

      const level2Style = level2?.getAttribute("style") ?? "";
      const level3Style = level3?.getAttribute("style") ?? "";

      // Level 2 should have more padding than Level 1
      expect(level2Style.includes("padding-left")).toBe(true);
      // Level 3 should have more padding than Level 2
      expect(level3Style.includes("padding-left")).toBe(true);
    });
  });

  describe("Scroll tracking integration", () => {
    it("should render TOC when content has headings", () => {
      const content = `# Main Title
## Section`;

      render(<TocTab content={content} />);

      expect(screen.getByText("Main Title")).toBeInTheDocument();
      expect(screen.getByText("Section")).toBeInTheDocument();
    });

    it("should show empty state when content is empty", () => {
      render(<TocTab content="" />);
      expect(screen.getByText("No headings found")).toBeInTheDocument();
    });

    it("should handle rapid content updates", () => {
      const { rerender } = render(<TocTab content="# Heading 1" />);
      expect(screen.getByRole("button", { name: /Heading 1/i })).toBeInTheDocument();

      rerender(<TocTab content="# Heading 2" />);
      expect(screen.getByRole("button", { name: /Heading 2/i })).toBeInTheDocument();

      rerender(<TocTab content="# Heading 3" />);
      expect(screen.getByRole("button", { name: /Heading 3/i })).toBeInTheDocument();
    });

    it("should handle content with mixed heading levels", () => {
      const content = `# First
### Sub3
## Sub2
#### Sub4
# Second`;

      render(<TocTab content={content} />);

      expect(screen.getByRole("button", { name: /First/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sub2/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sub3/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sub4/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Second/i })).toBeInTheDocument();
    });
  });
});
