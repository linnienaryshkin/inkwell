import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  fetchCurrentUser: jest.fn(),
  getLoginUrl: jest.fn(
    () => "http://localhost:8000/auth/login?redirect_url=http%3A%2F%2Flocalhost%3A5173%2F"
  ),
  logout: jest.fn(),
}));

import StudioPage from "./page";
import { fetchArticles, fetchCurrentUser, logout } from "@/services/api";

const mockFetchArticles = fetchArticles as jest.MockedFunction<typeof fetchArticles>;
const mockFetchCurrentUser = fetchCurrentUser as jest.MockedFunction<typeof fetchCurrentUser>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;

describe("StudioPage", () => {
  beforeEach(() => {
    mockFetchArticles.mockRejectedValue(new Error("API unavailable"));
    mockFetchCurrentUser.mockRejectedValue(new Error("Not authenticated"));
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

  describe("GitHub OAuth UI", () => {
    it("renders Sign in with GitHub link when unauthenticated", async () => {
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByRole("link", { name: /sign in with github/i })).toBeInTheDocument();
      });
    });

    it("does not render avatar when unauthenticated", async () => {
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
      });
    });

    it("renders avatar and login handle when authenticated", async () => {
      mockFetchCurrentUser.mockResolvedValue({
        login: "testuser",
        name: "Test",
        avatar_url: "https://example.com/a.png",
      });
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByRole("img", { name: "testuser" })).toBeInTheDocument();
        expect(screen.getByText("testuser")).toBeInTheDocument();
      });
    });

    it("does not render Sign in button when authenticated", async () => {
      mockFetchCurrentUser.mockResolvedValue({
        login: "testuser",
        name: "Test",
        avatar_url: "https://example.com/a.png",
      });
      render(<StudioPage />);
      await waitFor(() => {
        expect(
          screen.queryByRole("link", { name: /sign in with github/i })
        ).not.toBeInTheDocument();
      });
    });

    it("demo mode badge remains visible when unauthenticated", async () => {
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByText("demo mode")).toBeInTheDocument();
      });
    });
  });

  describe("Logout", () => {
    const authenticatedUser = {
      login: "testuser",
      name: "Test",
      avatar_url: "https://example.com/a.png",
    };

    it("renders profile menu trigger when authenticated", async () => {
      mockFetchCurrentUser.mockResolvedValue(authenticatedUser);
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /open profile menu/i })).toBeInTheDocument();
      });
    });

    it("does not render profile menu trigger when unauthenticated", async () => {
      render(<StudioPage />);
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /open profile menu/i })
        ).not.toBeInTheDocument();
      });
    });

    it("clicking profile trigger opens dropdown", async () => {
      mockFetchCurrentUser.mockResolvedValue(authenticatedUser);
      render(<StudioPage />);
      const trigger = await screen.findByRole("button", { name: /open profile menu/i });
      await userEvent.click(trigger);
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("clicking outside closes dropdown", async () => {
      mockFetchCurrentUser.mockResolvedValue(authenticatedUser);
      render(<StudioPage />);
      const trigger = await screen.findByRole("button", { name: /open profile menu/i });
      await userEvent.click(trigger);
      expect(screen.getByRole("menu")).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("clicking Sign out calls logout and clears user", async () => {
      mockFetchCurrentUser.mockResolvedValue(authenticatedUser);
      mockLogout.mockResolvedValue(undefined);
      render(<StudioPage />);
      const trigger = await screen.findByRole("button", { name: /open profile menu/i });
      await userEvent.click(trigger);
      const signOutItem = screen.getByRole("menuitem", { name: /sign out/i });
      await userEvent.click(signOutItem);
      expect(mockLogout).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: /sign in with github/i })).toBeInTheDocument();
      });
    });

    it("sign out clears user even if logout throws", async () => {
      mockFetchCurrentUser.mockResolvedValue(authenticatedUser);
      mockLogout.mockRejectedValue(new Error("Network error"));
      render(<StudioPage />);
      const trigger = await screen.findByRole("button", { name: /open profile menu/i });
      await userEvent.click(trigger);
      const signOutItem = screen.getByRole("menuitem", { name: /sign out/i });
      await userEvent.click(signOutItem);
      await waitFor(() => {
        expect(screen.getByRole("link", { name: /sign in with github/i })).toBeInTheDocument();
      });
    });
  });
});
