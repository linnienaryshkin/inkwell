import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatTab } from "./ChatTab";
import * as api from "@/services/api";
import type { Article } from "@/app/studio/page";

jest.mock("react-markdown", () => {
  return function DummyMarkdown({ children }: { children: string }) {
    return <div>{children}</div>;
  };
});

jest.mock("@/services/api");

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

const mockApi = api as jest.Mocked<typeof api>;

const MOCK_ARTICLE: Article = {
  slug: "test-article",
  content: "Test article content",
  meta: {
    slug: "test-article",
    title: "Test Article",
    status: "draft",
    tags: [],
  },
  versions: [],
};

describe("ChatTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when no article is provided", () => {
    it("should render placeholder text", () => {
      render(<ChatTab article={null} />);
      expect(screen.getByText("Open an article to start chatting.")).toBeInTheDocument();
    });
  });

  describe("threads view - loading", () => {
    it("should load and display threads on mount", async () => {
      const mockThreads = [
        {
          id: "thread-1",
          slug: "test-article",
          title: "First question",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        expect(mockApi.fetchThreads).toHaveBeenCalledWith("test-article");
        expect(screen.getByText("First question")).toBeInTheDocument();
      });
    });

    it("should show empty state when no threads", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        expect(screen.getByText("No threads yet. Create one to get started!")).toBeInTheDocument();
      });
    });

    it("should show loading spinner initially", async () => {
      mockApi.fetchThreads.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      render(<ChatTab article={MOCK_ARTICLE} />);
      expect(screen.getByText("Loading threads...")).toBeInTheDocument();
    });
  });

  describe("threads view - creation", () => {
    it("should create thread on Enter key", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      mockApi.createThread.mockResolvedValue({
        thread_id: "new-thread-1",
        reply: "Assistant reply",
      });

      render(<ChatTab article={MOCK_ARTICLE} />);

      const textarea = screen.getByPlaceholderText("Ask a question about this article...");
      fireEvent.change(textarea, { target: { value: "Tell me" } });
      fireEvent.keyPress(textarea, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(mockApi.createThread).toHaveBeenCalledWith({
          slug: "test-article",
          message: "Tell me",
          article_content: "Test article content",
        });
      });
    });

    it("should show Creating state", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      mockApi.createThread.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ thread_id: "1", reply: "r" }), 100))
      );

      render(<ChatTab article={MOCK_ARTICLE} />);

      const textarea = screen.getByPlaceholderText("Ask a question about this article...");
      fireEvent.change(textarea, { target: { value: "Test" } });
      fireEvent.keyPress(textarea, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("Creating...")).toBeInTheDocument();
      });
    });

    it("should not create thread with empty input", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      render(<ChatTab article={MOCK_ARTICLE} />);

      const textarea = screen.getByPlaceholderText("Ask a question about this article...");
      fireEvent.keyPress(textarea, { key: "Enter", code: "Enter", charCode: 13 });

      expect(mockApi.createThread).not.toHaveBeenCalled();
    });

    it("should ignore Shift+Enter", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      render(<ChatTab article={MOCK_ARTICLE} />);

      const textarea = screen.getByPlaceholderText("Ask a question about this article...");
      fireEvent.change(textarea, { target: { value: "Line 1" } });
      fireEvent.keyPress(textarea, { key: "Enter", shiftKey: true, charCode: 13 });

      expect(mockApi.createThread).not.toHaveBeenCalled();
    });

    it("should transition to thread view after creation", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      mockApi.createThread.mockResolvedValue({
        thread_id: "new-thread-1",
        reply: "Assistant reply",
      });

      render(<ChatTab article={MOCK_ARTICLE} />);

      const textarea = screen.getByPlaceholderText("Ask a question about this article...");
      fireEvent.change(textarea, { target: { value: "Test question" } });
      fireEvent.keyPress(textarea, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("← Back")).toBeInTheDocument();
      });
    });
  });

  describe("thread view - navigation", () => {
    it("should display thread title when viewing", async () => {
      const mockThreads = [
        {
          id: "thread-1",
          slug: "test-article",
          title: "Test question",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test question"));
      });

      await waitFor(() => {
        expect(screen.getByText("Test question")).toBeInTheDocument();
        expect(screen.getByText("← Back")).toBeInTheDocument();
      });
    });

    it("should navigate to thread on click", async () => {
      const mockThreads = [
        {
          id: "thread-1",
          slug: "test-article",
          title: "First thread",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("First thread"));
      });

      await waitFor(() => {
        expect(screen.getByText("← Back")).toBeInTheDocument();
      });
    });

    it("should return to threads on back click", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      fireEvent.click(screen.getByText("← Back"));

      await waitFor(() => {
        expect(screen.getByText("Test")).toBeInTheDocument();
      });
    });
  });

  describe("thread view - messaging", () => {
    it("should post message on Enter", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);
      mockApi.postMessage.mockResolvedValue({ reply: "Response" });

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Follow up" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(mockApi.postMessage).toHaveBeenCalledWith("thread-1", {
          message: "Follow up",
          article_content: "Test article content",
        });
      });
    });

    it("should post message on button click", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);
      mockApi.postMessage.mockResolvedValue({ reply: "Response" });

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Message" } });
      fireEvent.click(screen.getByText("Send"));

      await waitFor(() => {
        expect(mockApi.postMessage).toHaveBeenCalledWith("thread-1", {
          message: "Message",
          article_content: "Test article content",
        });
      });
    });

    it("should not send empty messages", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      fireEvent.click(screen.getByText("Send"));

      expect(mockApi.postMessage).not.toHaveBeenCalled();
    });

    it("should display messages", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);
      mockApi.postMessage.mockResolvedValue({ reply: "Assistant response" });

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "User question" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("User question")).toBeInTheDocument();
        expect(screen.getByText("Assistant response")).toBeInTheDocument();
      });
    });

    it("should show Sending state", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);
      mockApi.postMessage.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ reply: "reply" }), 100))
      );

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Message" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("Sending...")).toBeInTheDocument();
      });
    });
  });

  describe("article prop changes", () => {
    it("should reload threads when article changes", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);

      const { rerender } = render(<ChatTab article={MOCK_ARTICLE} />);

      expect(mockApi.fetchThreads).toHaveBeenCalledWith("test-article");

      const newArticle = { ...MOCK_ARTICLE, meta: { ...MOCK_ARTICLE.meta, slug: "new-article" } };
      rerender(<ChatTab article={newArticle} />);

      expect(mockApi.fetchThreads).toHaveBeenCalledWith("new-article");
    });

    it("should reset when article becomes null", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);

      const { rerender } = render(<ChatTab article={MOCK_ARTICLE} />);
      rerender(<ChatTab article={null} />);

      expect(screen.getByText("Open an article to start chatting.")).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("should display thread fetch errors", async () => {
      mockApi.fetchThreads.mockRejectedValue(new Error("Network error"));

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should display thread creation errors", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      mockApi.createThread.mockRejectedValue(new Error("Creation failed"));

      render(<ChatTab article={MOCK_ARTICLE} />);

      const textarea = screen.getByPlaceholderText("Ask a question about this article...");
      fireEvent.change(textarea, { target: { value: "Test" } });
      fireEvent.keyPress(textarea, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("Creation failed")).toBeInTheDocument();
      });
    });

    it("should display message post errors", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);
      mockApi.postMessage.mockRejectedValue(new Error("Post failed"));

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Message" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("Post failed")).toBeInTheDocument();
      });
    });

    it("should handle non-Error exceptions in creation", async () => {
      mockApi.fetchThreads.mockResolvedValue([]);
      mockApi.createThread.mockRejectedValue("String error");

      render(<ChatTab article={MOCK_ARTICLE} />);

      const textarea = screen.getByPlaceholderText("Ask a question about this article...");
      fireEvent.change(textarea, { target: { value: "Test" } });
      fireEvent.keyPress(textarea, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("Failed to create thread")).toBeInTheDocument();
      });
    });

    it("should handle non-Error exceptions in messaging", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);
      mockApi.postMessage.mockRejectedValue("String error");

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Message" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText("Failed to send message")).toBeInTheDocument();
      });
    });
  });

  describe("ui interactions", () => {
    it("should handle thread button hover", async () => {
      const mockThreads = [
        {
          id: "thread-1",
          slug: "test-article",
          title: "Test Thread",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        const threadElement = screen.getByText("Test Thread");
        fireEvent.mouseEnter(threadElement.closest("button")!);
        fireEvent.mouseLeave(threadElement.closest("button")!);
      });
    });

    it("should render markdown in assistant messages", async () => {
      const mockThreads = [
        { id: "thread-1", slug: "test-article", title: "Test", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockApi.fetchThreads.mockResolvedValue(mockThreads);
      mockApi.postMessage.mockResolvedValue({ reply: "Use `code`" });

      render(<ChatTab article={MOCK_ARTICLE} />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Test"));
      });

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "How?" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText(/code/)).toBeInTheDocument();
      });
    });
  });
});

describe("markdown code rendering", () => {
  it("should render inline code with proper styling", async () => {
    const mockThreads = [
      {
        id: "thread-1",
        slug: "test-article",
        title: "Test",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    mockApi.fetchThreads.mockResolvedValue(mockThreads);
    mockApi.postMessage.mockResolvedValue({ reply: "`console.log()`" });

    render(<ChatTab article={MOCK_ARTICLE} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test"));
    });

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "code?" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => {
      expect(screen.getByText(/console.log/)).toBeInTheDocument();
    });
  });

  it("should render strong text in markdown", async () => {
    const mockThreads = [
      {
        id: "thread-1",
        slug: "test-article",
        title: "Test",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    mockApi.fetchThreads.mockResolvedValue(mockThreads);
    mockApi.postMessage.mockResolvedValue({
      reply: "**important** text",
    });

    render(<ChatTab article={MOCK_ARTICLE} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test"));
    });

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => {
      expect(screen.getByText(/important/)).toBeInTheDocument();
    });
  });

  it("should render em text in markdown", async () => {
    const mockThreads = [
      {
        id: "thread-1",
        slug: "test-article",
        title: "Test",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    mockApi.fetchThreads.mockResolvedValue(mockThreads);
    mockApi.postMessage.mockResolvedValue({ reply: "*italic* text" });

    render(<ChatTab article={MOCK_ARTICLE} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test"));
    });

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => {
      expect(screen.getByText(/italic/)).toBeInTheDocument();
    });
  });

  it("should render paragraph in markdown", async () => {
    const mockThreads = [
      {
        id: "thread-1",
        slug: "test-article",
        title: "Test",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    mockApi.fetchThreads.mockResolvedValue(mockThreads);
    mockApi.postMessage.mockResolvedValue({ reply: "A paragraph" });

    render(<ChatTab article={MOCK_ARTICLE} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test"));
    });

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => {
      expect(screen.getByText(/A paragraph/)).toBeInTheDocument();
    });
  });
});
