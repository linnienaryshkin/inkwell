import { render, screen, fireEvent } from "@testing-library/react";
import { VersionStrip } from "./VersionStrip";
import type { ArticleVersion } from "@/app/studio/page";

const MOCK_VERSIONS: ArticleVersion[] = [
  { sha: "abc1234def5678", message: "Initial commit", committed_at: "today 14:02" },
  { sha: "def5678abc1234", message: "Fix typo", committed_at: "yesterday 11:30" },
  { sha: "aaa9999bbb8888", message: "Update content", committed_at: "3 days ago" },
];

describe("VersionStrip", () => {
  describe("Display", () => {
    it("should render the Versions header", () => {
      render(<VersionStrip slug="test-article" />);

      expect(screen.getByText("Versions")).toBeInTheDocument();
    });

    it("should display all version SHAs", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      // SHA is sliced to first 7 chars in the component
      expect(screen.getByText("abc1234")).toBeInTheDocument();
      expect(screen.getByText("def5678")).toBeInTheDocument();
      expect(screen.getByText("aaa9999")).toBeInTheDocument();
    });

    it("should display version dates", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      expect(screen.getByText("today 14:02")).toBeInTheDocument();
      expect(screen.getByText("yesterday 11:30")).toBeInTheDocument();
      expect(screen.getByText("3 days ago")).toBeInTheDocument();
    });

    it("should render Restore button", () => {
      render(<VersionStrip slug="test-article" />);

      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    });

    it("should render View diff button", () => {
      render(<VersionStrip slug="test-article" />);

      expect(screen.getByRole("button", { name: "View diff" })).toBeInTheDocument();
    });

    it("should have version buttons for each version", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      // Get all buttons (including Restore/View diff/Save, so we expect more)
      const buttons = container.querySelectorAll("button");
      // 3 versions + Restore + View diff + Save = 6 buttons
      expect(buttons.length).toBe(6);
    });
  });

  describe("Version Selection", () => {
    it("should select first version by default", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const firstVersionButton = buttons[0];

      // Selected version should have accent background
      const bgStyle = firstVersionButton.style.background;
      expect(bgStyle).toContain("var(--bg-tertiary)");
    });

    it("should allow selecting a different version", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const secondVersionButton = buttons[1];

      fireEvent.click(secondVersionButton);

      // After click, second button should have accent background
      const bgStyle = secondVersionButton.style.background;
      expect(bgStyle).toContain("var(--bg-tertiary)");
    });

    it("should deselect previous version when selecting new one", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const firstVersionButton = buttons[0];
      const secondVersionButton = buttons[1];

      // First button is selected initially
      expect(firstVersionButton.style.background).toContain("var(--bg-tertiary)");

      // Click second button
      fireEvent.click(secondVersionButton);

      // Now second button should be selected
      expect(secondVersionButton.style.background).toContain("var(--bg-tertiary)");
      // First button should not be selected
      expect(firstVersionButton.style.background).not.toContain("var(--bg-tertiary)");
    });

    it("should allow switching between multiple versions", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const firstVersionButton = buttons[0];
      const secondVersionButton = buttons[1];
      const thirdVersionButton = buttons[2];

      fireEvent.click(thirdVersionButton);
      expect(thirdVersionButton.style.background).toContain("var(--bg-tertiary)");

      fireEvent.click(firstVersionButton);
      expect(firstVersionButton.style.background).toContain("var(--bg-tertiary)");

      fireEvent.click(secondVersionButton);
      expect(secondVersionButton.style.background).toContain("var(--bg-tertiary)");
    });
  });

  describe("Version indicator styling", () => {
    it("should display status indicator dots for each version", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      // Look for the small dots in each version button
      const dots = container.querySelectorAll("button span.rounded-full");
      // Should have at least 3 dots (one per version)
      expect(dots.length).toBeGreaterThanOrEqual(3);
    });

    it("should show accent color for selected version indicator", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const firstVersionButton = buttons[0];
      const firstVersionDot = firstVersionButton.querySelector(
        "span.rounded-full"
      ) as HTMLElement | null;

      // Selected version should have accent background on indicator
      expect(firstVersionDot?.style.background).toContain("var(--accent)");
    });

    it("should show secondary text color for unselected version indicator", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const secondVersionButton = buttons[1];
      const secondVersionDot = secondVersionButton.querySelector(
        "span.rounded-full"
      ) as HTMLElement | null;

      // Unselected version should have secondary text color on indicator
      expect(secondVersionDot?.style.background).toContain("var(--text-secondary)");
    });
  });

  describe("Button styling", () => {
    it("should have borders on selected version button", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const firstVersionButton = buttons[0];

      const borderStyle = firstVersionButton.style.border;
      expect(borderStyle).toContain("1px solid var(--border)");
    });

    it("should have transparent border on unselected version button", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const secondVersionButton = buttons[1];

      const borderStyle = secondVersionButton.style.border;
      expect(borderStyle).toContain("transparent");
    });

    it("should display SHA in monospace font", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const monoElements = container.querySelectorAll("span.font-mono");
      // Each version button has a SHA in monospace
      // So we expect at least 3 monospace elements for SHAs
      expect(monoElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Action buttons", () => {
    it("should render Restore and View diff buttons together", () => {
      render(<VersionStrip slug="test-article" />);

      const restoreBtn = screen.getByRole("button", { name: "Restore" });
      const diffBtn = screen.getByRole("button", { name: "View diff" });

      expect(restoreBtn).toBeInTheDocument();
      expect(diffBtn).toBeInTheDocument();
    });

    it("should have consistent styling for action buttons", () => {
      render(<VersionStrip slug="test-article" />);

      const restoreBtn = screen.getByRole("button", { name: "Restore" });
      const diffBtn = screen.getByRole("button", { name: "View diff" });

      // Both should have similar styling
      expect(restoreBtn.style.borderColor).toBe(diffBtn.style.borderColor);
      expect(restoreBtn.style.color).toBe(diffBtn.style.color);
    });
  });

  describe("Integration", () => {
    it("should maintain selection state across multiple interactions", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = container.querySelectorAll("button");
      const secondVersionButton = buttons[1];
      const restoreButton = screen.getByRole("button", { name: "Restore" });

      // Select second version
      fireEvent.click(secondVersionButton);
      expect(secondVersionButton.style.background).toContain("var(--bg-tertiary)");

      // Click Restore button (should not affect selection)
      fireEvent.click(restoreButton);

      // Second version should still be selected
      expect(secondVersionButton.style.background).toContain("var(--bg-tertiary)");
    });

    it("should allow viewing versions then using action buttons", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const buttons = screen.getAllByRole("button");
      const thirdVersionButton = buttons[2];
      const diffButton = screen.getByRole("button", { name: "View diff" });

      fireEvent.click(thirdVersionButton);
      fireEvent.click(diffButton);

      expect(diffButton).toBeInTheDocument();
    });
  });

  describe("versions prop", () => {
    it("renders version dots from versions prop", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);

      const dots = container.querySelectorAll("button span.rounded-full");
      expect(dots.length).toBe(MOCK_VERSIONS.length);
    });

    it("renders no version buttons when versions is empty", () => {
      const { container } = render(<VersionStrip slug="test-article" versions={[]} />);

      // Only Restore + View diff + Save buttons present, no version buttons
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(3);
    });
  });

  describe("Save button", () => {
    it("Save button has green style when isDirty is true", () => {
      render(<VersionStrip slug="test-article" isDirty={true} />);

      const saveBtn = screen.getByRole("button", { name: "Save" });
      expect(saveBtn.style.background).toContain("var(--green)");
    });

    it("Save button has muted style when isDirty is false", () => {
      render(<VersionStrip slug="test-article" isDirty={false} />);

      const saveBtn = screen.getByRole("button", { name: "Save" });
      expect(saveBtn.style.background).not.toContain("var(--green)");
    });

    it("Save button is disabled when saving is true", () => {
      render(<VersionStrip slug="test-article" saving={true} />);

      const saveBtn = screen.getByRole("button", { name: "Saving…" });
      expect(saveBtn).toBeDisabled();
    });

    it("calls onSave when Save button is clicked", () => {
      const handleSave = jest.fn();
      render(<VersionStrip slug="test-article" isDirty={true} onSave={handleSave} />);

      const saveBtn = screen.getByRole("button", { name: "Save" });
      fireEvent.click(saveBtn);

      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it("does not call onSave when saving is true", () => {
      const handleSave = jest.fn();
      render(<VersionStrip slug="test-article" saving={true} onSave={handleSave} />);

      const saveBtn = screen.getByRole("button", { name: "Saving…" });
      expect(saveBtn).toBeDisabled();
      fireEvent.click(saveBtn);

      expect(handleSave).not.toHaveBeenCalled();
    });
  });

  describe("onSave not provided", () => {
    it("does not throw when Save is clicked without onSave prop", () => {
      render(<VersionStrip slug="test-article" isDirty={true} />);

      const saveBtn = screen.getByRole("button", { name: "Save" });
      expect(() => fireEvent.click(saveBtn)).not.toThrow();
    });
  });
});
