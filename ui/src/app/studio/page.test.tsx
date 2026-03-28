import { render, screen, waitFor } from "@testing-library/react";

// Mock the heavy components that use ESM modules
jest.mock("@/components/EditorPane", () => ({
  EditorPane: () => <div data-testid="editor-pane">Editor Pane</div>,
}));

jest.mock("@/components/ArticleList", () => ({
  ArticleList: () => <div data-testid="article-list">Article List</div>,
}));

jest.mock("@/components/SidePanel", () => ({
  SidePanel: () => <div data-testid="side-panel">Side Panel</div>,
}));

jest.mock("@/components/VersionStrip", () => ({
  VersionStrip: () => <div data-testid="version-strip">Version Strip</div>,
}));

jest.mock("@/services/api", () => ({
  fetchArticles: jest.fn(),
}));

import StudioPage from "./page";
import { fetchArticles } from "@/services/api";

const mockFetchArticles = fetchArticles as jest.MockedFunction<typeof fetchArticles>;

describe("StudioPage", () => {
  beforeEach(() => {
    mockFetchArticles.mockRejectedValue(new Error("API unavailable"));
  });

  describe("Data Source Indicator", () => {
    it("should show demo mode badge when API is unavailable", async () => {
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByText("demo mode")).toBeInTheDocument();
      });
    });

    it("should show live badge when API responds", async () => {
      mockFetchArticles.mockResolvedValue([
        {
          slug: "test",
          title: "Test",
          status: "draft",
          content: "# Test",
          tags: [],
        },
      ]);
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByText("live")).toBeInTheDocument();
      });
    });
  });

  describe("GitHub Repository Link", () => {
    it("should render GitHub icon link in header", () => {
      render(<StudioPage />);
      const githubLink = screen.getByRole("link", {
        name: /visit inkwell github repository/i,
      });
      expect(githubLink).toBeInTheDocument();
    });

    it("should link to correct GitHub repository URL", () => {
      render(<StudioPage />);
      const githubLink = screen.getByRole("link", {
        name: /visit inkwell github repository/i,
      }) as HTMLAnchorElement;
      expect(githubLink.href).toBe("https://github.com/linnienaryshkin/inkwell");
    });

    it("should open link in new tab", () => {
      render(<StudioPage />);
      const githubLink = screen.getByRole("link", {
        name: /visit inkwell github repository/i,
      });
      expect(githubLink).toHaveAttribute("target", "_blank");
    });

    it("should have rel attribute for security", () => {
      render(<StudioPage />);
      const githubLink = screen.getByRole("link", {
        name: /visit inkwell github repository/i,
      });
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should have proper aria-label for accessibility", () => {
      render(<StudioPage />);
      const githubLink = screen.getByRole("link", {
        name: /visit inkwell github repository/i,
      });
      expect(githubLink).toHaveAttribute("aria-label", "Visit Inkwell GitHub repository");
    });

    it("should have title attribute for tooltip", () => {
      render(<StudioPage />);
      const githubLink = screen.getByRole("link", {
        name: /visit inkwell github repository/i,
      });
      expect(githubLink).toHaveAttribute("title", "Visit Inkwell GitHub repository");
    });
  });

  describe("Header Layout", () => {
    it("should render header with Inkwell title", () => {
      render(<StudioPage />);
      expect(screen.getByText("Inkwell")).toBeInTheDocument();
    });

    it("should render theme toggle button", () => {
      render(<StudioPage />);
      const themeButton = screen.getByRole("button", {
        name: /☀ Light/,
      });
      expect(themeButton).toBeInTheDocument();
    });
  });
});
