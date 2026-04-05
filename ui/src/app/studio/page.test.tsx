import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the heavy components that use ESM modules
jest.mock("@/components/EditorPane", () => ({
  EditorPane: ({
    onChange,
    onTitleChange,
    onTagsChange,
  }: {
    onChange: (v: string) => void;
    onTitleChange?: (v: string) => void;
    onTagsChange?: (v: string[]) => void;
  }) => (
    <div data-testid="editor-pane">
      <button onClick={() => onChange("new content")}>Change Content</button>
      <button onClick={() => onTitleChange?.("New Title")}>Change Title</button>
      <button onClick={() => onTagsChange?.(["newtag"])}>Change Tags</button>
    </div>
  ),
}));

jest.mock("@/components/ArticleList", () => ({
  ArticleList: ({ onNewArticle }: { onNewArticle?: () => void }) => (
    <div data-testid="article-list">
      <button onClick={onNewArticle}>New Article</button>
    </div>
  ),
}));

jest.mock("@/components/SidePanel", () => ({
  SidePanel: () => <div data-testid="side-panel">Side Panel</div>,
}));

jest.mock("@/components/VersionStrip", () => ({
  VersionStrip: ({
    isDirty,
    saving,
    onSave,
  }: {
    isDirty?: boolean;
    saving?: boolean;
    onSave?: () => void;
  }) => (
    <div data-testid="version-strip">
      <span data-testid="is-dirty">{isDirty ? "dirty" : "clean"}</span>
      <span data-testid="is-saving">{saving ? "saving" : "idle"}</span>
      <button onClick={onSave}>Save</button>
    </div>
  ),
}));

jest.mock("@/services/api", () => ({
  fetchArticles: jest.fn(),
  fetchArticle: jest.fn(),
  fetchCurrentUser: jest.fn(),
  getLoginUrl: jest.fn(
    () => "http://localhost:8000/auth/login?redirect_url=http%3A%2F%2Flocalhost%3A5173%2F"
  ),
  logout: jest.fn(),
  createArticle: jest.fn(),
  saveArticle: jest.fn(),
}));

import StudioPage from "./page";
import {
  fetchArticles,
  fetchArticle,
  fetchCurrentUser,
  logout,
  createArticle,
  saveArticle,
} from "@/services/api";

const mockFetchArticles = fetchArticles as jest.MockedFunction<typeof fetchArticles>;
const mockFetchArticle = fetchArticle as jest.MockedFunction<typeof fetchArticle>;
const mockFetchCurrentUser = fetchCurrentUser as jest.MockedFunction<typeof fetchCurrentUser>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;
const mockCreateArticle = createArticle as jest.MockedFunction<typeof createArticle>;
const mockSaveArticle = saveArticle as jest.MockedFunction<typeof saveArticle>;

describe("StudioPage", () => {
  beforeEach(() => {
    mockFetchArticles.mockRejectedValue(new Error("API unavailable"));
    mockFetchArticle.mockRejectedValue(new Error("API unavailable"));
    mockFetchCurrentUser.mockRejectedValue(new Error("Not authenticated"));
    mockCreateArticle.mockReset();
    mockSaveArticle.mockReset();
    mockLogout.mockReset();
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
          tags: [],
        },
      ]);
      mockFetchArticle.mockResolvedValue({
        slug: "test",
        content: "# Test",
        meta: { slug: "test", title: "Test", status: "draft", tags: [] },
        versions: [],
      });
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByText("live")).toBeInTheDocument();
      });
    });
  });

  describe("Article Loading", () => {
    it("shows loading indicator while fetching an article", async () => {
      // fetchArticle never resolves so loading state persists
      mockFetchArticles.mockResolvedValue([
        { slug: "test", title: "Test", status: "draft", tags: [] },
      ]);
      mockFetchArticle.mockImplementation(() => new Promise(() => {}));
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.getByTestId("article-loading")).toBeInTheDocument();
      });
    });

    it("hides loading indicator after article fetch resolves", async () => {
      mockFetchArticles.mockResolvedValue([
        { slug: "test", title: "Test", status: "draft", tags: [] },
      ]);
      mockFetchArticle.mockResolvedValue({
        slug: "test",
        content: "# Test",
        meta: { slug: "test", title: "Test", status: "draft", tags: [] },
        versions: [],
      });
      render(<StudioPage />);
      await waitFor(() => {
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
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

  describe("isDirty state", () => {
    it("isDirty becomes true when content changes", async () => {
      render(<StudioPage />);

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Change Content" }));

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("dirty");
      });
    });

    it("isDirty becomes true when title changes", async () => {
      render(<StudioPage />);

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Change Title" }));

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("dirty");
      });
    });

    it("isDirty becomes true when tags change", async () => {
      render(<StudioPage />);

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Change Tags" }));

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("dirty");
      });
    });

    it("isDirty resets to false after successful save", async () => {
      const savedArticle = {
        slug: "welcome",
        content: "new content",
        meta: { slug: "welcome", title: "Welcome to Inkwell", status: "draft" as const, tags: [] },
        versions: [],
      };
      mockSaveArticle.mockResolvedValue(savedArticle);

      render(<StudioPage />);

      // Wait for editor-pane to mount before interacting
      await waitFor(() => {
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      // Make it dirty first
      fireEvent.click(screen.getByRole("button", { name: "Change Content" }));
      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("dirty");
      });

      // Trigger save
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
      });
    });
  });

  describe("handleNewArticle", () => {
    it("handleNewArticle sets selectedSlug to __new__ and selectedArticle to EMPTY_ARTICLE", async () => {
      render(<StudioPage />);

      // Click the New Article button in the mocked ArticleList
      fireEvent.click(screen.getByRole("button", { name: "New Article" }));

      // After calling handleNewArticle the editor pane should still be visible
      // (selectedArticle is set to EMPTY_ARTICLE, not null)
      await waitFor(() => {
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      // isDirty should be false
      expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
    });
  });

  describe("handleSave", () => {
    it("handleSave calls createArticle for __new__ slug", async () => {
      const newArticle = {
        slug: "my-new-article",
        content: "",
        meta: {
          slug: "my-new-article",
          title: "My New Article",
          status: "draft" as const,
          tags: [],
        },
        versions: [],
      };
      mockCreateArticle.mockResolvedValue(newArticle);

      render(<StudioPage />);

      // Navigate to new article
      fireEvent.click(screen.getByRole("button", { name: "New Article" }));

      // Set the title via the Change Title button (sets "New Title")
      fireEvent.click(screen.getByRole("button", { name: "Change Title" }));

      // Trigger save
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      await waitFor(() => {
        expect(mockCreateArticle).toHaveBeenCalledTimes(1);
      });
    });

    it("handleSave calls saveArticle for existing slug", async () => {
      const savedArticle = {
        slug: "welcome",
        content: "new content",
        meta: { slug: "welcome", title: "Welcome to Inkwell", status: "draft" as const, tags: [] },
        versions: [],
      };
      mockSaveArticle.mockResolvedValue(savedArticle);

      render(<StudioPage />);

      // Wait for editor-pane to mount before interacting
      await waitFor(() => {
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      // Make dirty on existing article
      fireEvent.click(screen.getByRole("button", { name: "Change Content" }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      await waitFor(() => {
        expect(mockSaveArticle).toHaveBeenCalledWith(
          "welcome",
          expect.objectContaining({ content: "new content" })
        );
      });
    });

    it("handleSave derives slug from title", async () => {
      const newArticle = {
        slug: "my-new-title",
        content: "",
        meta: {
          slug: "my-new-title",
          title: "My New Title",
          status: "draft" as const,
          tags: [],
        },
        versions: [],
      };
      mockCreateArticle.mockResolvedValue(newArticle);

      render(<StudioPage />);

      // Navigate to new article mode
      fireEvent.click(screen.getByRole("button", { name: "New Article" }));

      // Set title to "New Title" via mock button
      fireEvent.click(screen.getByRole("button", { name: "Change Title" }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      await waitFor(() => {
        // slug derived from "New Title" → "new-title"
        expect(mockCreateArticle).toHaveBeenCalledWith(
          "New Title",
          "new-title",
          expect.anything(),
          expect.anything()
        );
      });
    });

    it("handleSave on success appends meta to summaries", async () => {
      const newArticle = {
        slug: "new-article",
        content: "",
        meta: { slug: "new-article", title: "New Title", status: "draft" as const, tags: [] },
        versions: [],
      };
      mockCreateArticle.mockResolvedValue(newArticle);

      render(<StudioPage />);

      fireEvent.click(screen.getByRole("button", { name: "New Article" }));
      fireEvent.click(screen.getByRole("button", { name: "Change Title" }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      await waitFor(() => {
        expect(mockCreateArticle).toHaveBeenCalledTimes(1);
      });

      // After save, isDirty should be false (meta was appended + isDirty cleared)
      expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
    });

    it("handleSave on success clears isDirty", async () => {
      const savedArticle = {
        slug: "welcome",
        content: "new content",
        meta: { slug: "welcome", title: "Welcome to Inkwell", status: "draft" as const, tags: [] },
        versions: [],
      };
      mockSaveArticle.mockResolvedValue(savedArticle);

      render(<StudioPage />);

      // Wait for editor-pane to mount before interacting
      await waitFor(() => {
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Change Content" }));
      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("dirty");
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
      });
    });
  });

  describe("beforeunload", () => {
    it("beforeunload fires when isDirty is true", async () => {
      render(<StudioPage />);

      // Wait for editor-pane to mount before interacting
      await waitFor(() => {
        expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
      });

      // Make it dirty
      fireEvent.click(screen.getByRole("button", { name: "Change Content" }));
      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("dirty");
      });

      const event = new Event("beforeunload") as BeforeUnloadEvent;
      Object.defineProperty(event, "returnValue", { writable: true, value: "" });
      const prevented = jest.fn();
      event.preventDefault = prevented;
      window.dispatchEvent(event);
      expect(prevented).toHaveBeenCalled();
    });

    it("beforeunload does not fire when isDirty is false", async () => {
      render(<StudioPage />);

      await waitFor(() => {
        expect(screen.getByTestId("is-dirty")).toHaveTextContent("clean");
      });

      const event = new Event("beforeunload") as BeforeUnloadEvent;
      Object.defineProperty(event, "returnValue", { writable: true, value: "" });
      const prevented = jest.fn();
      event.preventDefault = prevented;
      window.dispatchEvent(event);
      expect(prevented).not.toHaveBeenCalled();
    });
  });
});
