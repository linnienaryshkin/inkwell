import { render, screen, fireEvent } from "@testing-library/react";
import { VersionStrip } from "./VersionStrip";
import type { ArticleVersion } from "@/app/studio/page";

const MOCK_VERSIONS: ArticleVersion[] = [
  { sha: "abc1234def5678", message: "Initial commit", committed_at: "2026-01-15T10:00:00Z" },
  { sha: "def5678abc1234", message: "Fix typo", committed_at: "2026-02-20T14:30:00Z" },
  { sha: "aaa9999bbb8888", message: "Update content", committed_at: "2026-03-05T09:15:00Z" },
];

describe("VersionStrip", () => {
  describe("Display", () => {
    it("renders the Versions button", () => {
      render(<VersionStrip slug="test-article" />);
      expect(screen.getByRole("button", { name: /Versions/i })).toBeInTheDocument();
    });

    it("renders the Save button", () => {
      render(<VersionStrip slug="test-article" />);
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("does not show version items before the menu is opened", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);
      expect(screen.queryByText("Initial commit")).not.toBeInTheDocument();
    });
  });

  describe("Versions dropdown", () => {
    it("opens the menu when Versions button is clicked", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);
      fireEvent.click(screen.getByRole("button", { name: /Versions/i }));
      expect(screen.getByText("Initial commit")).toBeInTheDocument();
      expect(screen.getByText("Fix typo")).toBeInTheDocument();
      expect(screen.getByText("Update content")).toBeInTheDocument();
    });

    it("closes the menu when Versions button is clicked again", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);
      const btn = screen.getByRole("button", { name: /Versions/i });
      fireEvent.click(btn);
      expect(screen.getByText("Initial commit")).toBeInTheDocument();
      fireEvent.click(btn);
      expect(screen.queryByText("Initial commit")).not.toBeInTheDocument();
    });

    it("shows human-readable dates in the menu", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);
      fireEvent.click(screen.getByRole("button", { name: /Versions/i }));
      // dates should be formatted (not raw ISO strings)
      expect(screen.queryByText("2026-01-15T10:00:00Z")).not.toBeInTheDocument();
    });

    it("shows 'No versions yet' when versions is empty", () => {
      render(<VersionStrip slug="test-article" versions={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /Versions/i }));
      expect(screen.getByText("No versions yet")).toBeInTheDocument();
    });

    it("each version is a link to the GitHub commit", () => {
      render(<VersionStrip slug="test-article" versions={MOCK_VERSIONS} />);
      fireEvent.click(screen.getByRole("button", { name: /Versions/i }));
      const link = screen.getByRole("link", { name: /Initial commit/i });
      expect(link).toHaveAttribute(
        "href",
        "https://github.com/linnienaryshkin/inkwell/commit/abc1234def5678"
      );
    });

    it("resets (closes) menu when slug changes", () => {
      const { rerender } = render(<VersionStrip slug="article-1" versions={MOCK_VERSIONS} />);
      fireEvent.click(screen.getByRole("button", { name: /Versions/i }));
      expect(screen.getByText("Initial commit")).toBeInTheDocument();

      rerender(<VersionStrip slug="article-2" versions={MOCK_VERSIONS} />);
      expect(screen.queryByText("Initial commit")).not.toBeInTheDocument();
    });
  });

  describe("Save button", () => {
    it("has green style when isDirty is true", () => {
      render(<VersionStrip slug="test-article" isDirty={true} />);
      const saveBtn = screen.getByRole("button", { name: "Save" });
      expect(saveBtn.style.background).toContain("var(--green)");
    });

    it("has muted style when isDirty is false", () => {
      render(<VersionStrip slug="test-article" isDirty={false} />);
      const saveBtn = screen.getByRole("button", { name: "Save" });
      expect(saveBtn.style.background).not.toContain("var(--green)");
    });

    it("is disabled when isDirty is false", () => {
      render(<VersionStrip slug="test-article" isDirty={false} />);
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("is enabled when isDirty is true", () => {
      render(<VersionStrip slug="test-article" isDirty={true} />);
      expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    });

    it("is disabled when saving is true", () => {
      render(<VersionStrip slug="test-article" saving={true} />);
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    });

    it("calls onSave when Save is clicked while dirty", () => {
      const handleSave = jest.fn();
      render(<VersionStrip slug="test-article" isDirty={true} onSave={handleSave} />);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it("does not call onSave when saving is true", () => {
      const handleSave = jest.fn();
      render(<VersionStrip slug="test-article" saving={true} onSave={handleSave} />);
      fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
      expect(handleSave).not.toHaveBeenCalled();
    });

    it("does not throw when Save is clicked without onSave prop", () => {
      render(<VersionStrip slug="test-article" isDirty={true} />);
      expect(() => fireEvent.click(screen.getByRole("button", { name: "Save" }))).not.toThrow();
    });

    it("shows tooltip 'No unsaved changes' when not dirty", () => {
      render(<VersionStrip slug="test-article" isDirty={false} />);
      expect(screen.getByTitle("No unsaved changes")).toBeInTheDocument();
    });

    it("shows tooltip 'Save changes' when dirty", () => {
      render(<VersionStrip slug="test-article" isDirty={true} />);
      expect(screen.getByTitle("Save changes")).toBeInTheDocument();
    });
  });
});
