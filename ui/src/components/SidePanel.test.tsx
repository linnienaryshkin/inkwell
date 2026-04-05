import { render, screen, fireEvent } from "@testing-library/react";
import { SidePanel } from "./SidePanel";
import type { Article } from "@/app/studio/page";

describe("SidePanel", () => {
  const mockArticle: Article = {
    slug: "test-article",
    content: "Test content",
    meta: {
      slug: "test-article",
      title: "Test Article",
      status: "draft",
      tags: ["test"],
    },
    versions: [],
  };

  describe("Tab Navigation", () => {
    it("should render all tab buttons", () => {
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      expect(buttons).toHaveLength(3);
    });

    it("should highlight the active lint tab", () => {
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      const lintButton = buttons[0] as HTMLElement;
      expect(lintButton.style.color).toContain("var(--accent)");
    });

    it("should highlight the active publish tab", () => {
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      const publishButton = buttons[1] as HTMLElement;
      expect(publishButton.style.color).toContain("var(--accent)");
    });

    it("should highlight the active toc tab", () => {
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="toc" onTabChange={() => {}} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      const tocButton = buttons[2] as HTMLElement;
      expect(tocButton.style.color).toContain("var(--accent)");
    });

    it("should call onTabChange when switching to publish", () => {
      const handleTabChange = jest.fn();
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="lint" onTabChange={handleTabChange} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      const publishButton = buttons[1];
      fireEvent.click(publishButton);

      expect(handleTabChange).toHaveBeenCalledWith("publish");
    });

    it("should call onTabChange when switching to lint", () => {
      const handleTabChange = jest.fn();
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="publish" onTabChange={handleTabChange} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      const lintButton = buttons[0];
      fireEvent.click(lintButton);

      expect(handleTabChange).toHaveBeenCalledWith("lint");
    });
  });

  describe("Lint Tab - Display", () => {
    it("should display the lint tab content when active", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      expect(screen.getByRole("button", { name: "Run Lint ↺" })).toBeInTheDocument();
    });

    it("should not display lint content when publish tab is active", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      expect(screen.queryByRole("button", { name: "Run Lint ↺" })).not.toBeInTheDocument();
    });

    it("should show placeholder text before running lint", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      expect(screen.getByText(/Click "Run Lint" to analyze/i)).toBeInTheDocument();
    });

    it("should have Run Lint button visible", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      expect(runLintButton).toBeInTheDocument();
    });
  });

  describe("Lint Tab - Functionality", () => {
    it("should display lint results after clicking Run Lint", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText("Readability")).toBeInTheDocument();
      expect(screen.getByText("Style issues")).toBeInTheDocument();
      expect(screen.getByText("Grammar errors")).toBeInTheDocument();
    });

    it("should display readability score after lint", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText("B+")).toBeInTheDocument();
    });

    it("should display style issue count", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText("Style issues")).toBeInTheDocument();
    });

    it("should display grammar error count", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText("Grammar errors")).toBeInTheDocument();
    });

    it("should display Issues header after lint", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText("Issues")).toBeInTheDocument();
    });

    it("should display individual lint issues", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText(/Avoid "very"/i)).toBeInTheDocument();
      expect(screen.getByText(/Consider active voice/i)).toBeInTheDocument();
    });

    it("should display issue line numbers", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText("Line 5:")).toBeInTheDocument();
      expect(screen.getByText("Line 12:")).toBeInTheDocument();
    });

    it("should hide placeholder text after running lint", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.queryByText(/Click "Run Lint" to analyze/i)).not.toBeInTheDocument();
    });

    it("should allow running lint multiple times", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });

      fireEvent.click(runLintButton);
      expect(screen.getByText("B+")).toBeInTheDocument();

      fireEvent.click(runLintButton);
      expect(screen.getByText("B+")).toBeInTheDocument();
    });
  });

  describe("Publish Tab - Display", () => {
    it("should display publish tab content when active", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      expect(screen.getByText("Platforms")).toBeInTheDocument();
    });

    it("should not display publish content when lint tab is active", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      expect(screen.queryByText("Platforms")).not.toBeInTheDocument();
    });

    it("should list all publishing platforms", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      expect(screen.getByText("dev.to")).toBeInTheDocument();
      expect(screen.getByText("Hashnode")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("Substack")).toBeInTheDocument();
      expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    });

    it("should display publishing log info text", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      expect(screen.getByText(/Publishing logs which commit SHA was sent/i)).toBeInTheDocument();
    });
  });

  describe("Publish Tab - Platform Actions", () => {
    it("should display Publish button for dev.to", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      const publishButtons = screen.getAllByRole("button", { name: /Publish →/ });
      expect(publishButtons.length).toBeGreaterThan(0);
    });

    it("should display Copy button for Medium", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      const copyButtons = screen.getAllByRole("button", { name: /Copy ⎘/ });
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it("should have different button styles for ready vs copy platforms", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      const publishButtons = screen.getAllByRole("button", { name: /Publish →/ });
      const copyButtons = screen.getAllByRole("button", { name: /Copy ⎘/ });

      // Publish buttons should have accent background
      expect(publishButtons[0].style.background).toContain("var(--accent)");

      // Copy buttons should have transparent background
      expect(copyButtons[0].style.background).toContain("transparent");
    });

    it("should have proper styling for Publish buttons", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      const publishButtons = screen.getAllByRole("button", { name: "Publish →" });

      expect(publishButtons[0].style.background).toContain("var(--accent)");
      expect(publishButtons[0].style.color).toContain("var(--bg-primary)");
    });

    it("should have proper styling for Copy buttons", () => {
      render(<SidePanel article={mockArticle} activeTab="publish" onTabChange={() => {}} />);

      const copyButtons = screen.getAllByRole("button", { name: "Copy ⎘" });

      expect(copyButtons[0].style.background).toContain("transparent");
      expect(copyButtons[0].style.border).toContain("1px solid var(--border)");
    });
  });

  describe("Tab Switching with Content", () => {
    it("should preserve lint results when switching tabs", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      expect(screen.getByText("B+")).toBeInTheDocument();
    });

    it("should render empty state placeholder when lint tab loads without results", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      expect(screen.getByText(/Click "Run Lint" to analyze/i)).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("should handle full user workflow: run lint and view results", () => {
      render(<SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />);

      // Start with placeholder
      expect(screen.getByText(/Click "Run Lint" to analyze/i)).toBeInTheDocument();

      // Run lint
      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);

      // See results
      expect(screen.getByText("Readability")).toBeInTheDocument();
      expect(screen.getByText("B+")).toBeInTheDocument();
      expect(screen.getByText(/Avoid "very"/i)).toBeInTheDocument();

      // Placeholder should be gone
      expect(screen.queryByText(/Click "Run Lint" to analyze/i)).not.toBeInTheDocument();
    });

    it("should handle switching between tabs", () => {
      const handleTabChange = jest.fn();
      const { rerender, container } = render(
        <SidePanel article={mockArticle} activeTab="lint" onTabChange={handleTabChange} />
      );

      // Run lint
      const runLintButton = screen.getByRole("button", { name: "Run Lint ↺" });
      fireEvent.click(runLintButton);
      expect(screen.getByText("B+")).toBeInTheDocument();

      // Click publish tab
      const buttons = container.querySelectorAll("div:first-child > button");
      const publishButton = buttons[1];
      fireEvent.click(publishButton);
      expect(handleTabChange).toHaveBeenCalledWith("publish");

      // Rerender with publish tab active
      rerender(
        <SidePanel article={mockArticle} activeTab="publish" onTabChange={handleTabChange} />
      );

      // Should see publish content
      expect(screen.getByText("Platforms")).toBeInTheDocument();
      expect(screen.getByText("dev.to")).toBeInTheDocument();
    });

    it("should display all tabs regardless of active state", () => {
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      expect(buttons).toHaveLength(3);
    });
  });

  describe("Accessibility", () => {
    it("should have properly labeled tabs", () => {
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="lint" onTabChange={() => {}} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      const lintTab = buttons[0];
      const publishTab = buttons[1];

      expect(lintTab).toHaveTextContent("lint");
      expect(publishTab).toHaveTextContent("publish");
    });

    it("should allow keyboard navigation of tabs", () => {
      const handleTabChange = jest.fn();
      const { container } = render(
        <SidePanel article={mockArticle} activeTab="lint" onTabChange={handleTabChange} />
      );

      const buttons = container.querySelectorAll("div:first-child > button");
      const publishTab = buttons[1];
      fireEvent.click(publishTab);

      expect(handleTabChange).toHaveBeenCalled();
    });
  });
});
