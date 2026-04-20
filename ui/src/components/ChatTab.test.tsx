import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatTab } from "./ChatTab";
import * as api from "@/services/api";

jest.mock("@/services/api");

const mockArticle = {
  slug: "test-article",
  content: "Test article content",
  meta: {
    slug: "test-article",
    title: "Test Article",
    status: "draft" as const,
    tags: [],
  },
  versions: [],
};

const mockThread: api.ChatThread = {
  thread_id: "thread-1",
  article_slug: "test-article",
  title: "First question",
  created_at: new Date().toISOString(),
};

describe("ChatTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("with no article selected", () => {
    it("shows placeholder text", () => {
      render(<ChatTab article={null} />);
      expect(screen.getByText("Select an article to start chatting")).toBeInTheDocument();
    });
  });

  describe("threads view", () => {
    it("renders threads list on mount", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([mockThread]);

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(api.fetchChatThreads).toHaveBeenCalledWith("test-article");
      });

      expect(screen.getByText("First question")).toBeInTheDocument();
    });

    it("shows empty state when no threads exist", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(screen.getByText("No threads yet")).toBeInTheDocument();
      });
    });

    it("creates a new thread when 'New Chat' is clicked", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(api.createChatThread).toHaveBeenCalledWith("test-article");
      });

      // Should switch to thread view
      expect(screen.getByText("← Back")).toBeInTheDocument();
    });

    it("switches to thread view when a thread is clicked", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([mockThread]);

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(screen.getByText("First question")).toBeInTheDocument();
      });

      const threadButton = screen.getByText("First question");
      fireEvent.click(threadButton);

      expect(screen.getByText("← Back")).toBeInTheDocument();
    });
  });

  describe("thread view", () => {
    it("renders message input and send button", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    });

    it("sends a message and displays the response", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockThread]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.sendChatMessage as jest.Mock).mockResolvedValue({
        thread_id: "thread-1",
        reply: "This is a helpful response",
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "This is a helpful response" },
        ],
      });

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(api.sendChatMessage).toHaveBeenCalledWith(
          "thread-1",
          "Hello",
          "Test article content"
        );
      });

      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("This is a helpful response")).toBeInTheDocument();
    });

    it("disables input while sending", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.sendChatMessage as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(sendButton);

      // Button should show "Sending..." while the request is in flight
      expect(sendButton).toHaveTextContent("Sending...");
      expect(textarea).toBeDisabled();
    });

    it("goes back to threads view when back button is clicked", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByText("← Back")).toBeInTheDocument();
      });

      const backButton = screen.getByText("← Back");
      fireEvent.click(backButton);

      expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();
    });

    it("displays error messages", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.sendChatMessage as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to send message")).toBeInTheDocument();
      });
    });
  });

  describe("article change", () => {
    it("reloads threads when article slug changes", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([mockThread]);

      const { rerender } = render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(api.fetchChatThreads).toHaveBeenCalledWith("test-article");
      });

      const newArticle = { ...mockArticle, slug: "new-article" };
      rerender(<ChatTab article={newArticle} />);

      await waitFor(() => {
        expect(api.fetchChatThreads).toHaveBeenCalledWith("new-article");
      });
    });
  });

  describe("error handling", () => {
    it("displays error when fetching threads fails", async () => {
      (api.fetchChatThreads as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load threads")).toBeInTheDocument();
      });
    });

    it("displays error when creating thread fails", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();
      });

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to create thread")).toBeInTheDocument();
      });
    });
  });

  describe("keyboard shortcuts", () => {
    it("sends message on Shift+Enter", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.sendChatMessage as jest.Mock).mockResolvedValue({
        thread_id: "thread-1",
        reply: "Response",
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "Response" },
        ],
      });

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

      // Shift+Enter should NOT send
      expect(api.sendChatMessage).not.toHaveBeenCalled();
    });

    it("sends message on Enter alone", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.sendChatMessage as jest.Mock).mockResolvedValue({
        thread_id: "thread-1",
        reply: "Response",
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "Response" },
        ],
      });

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

      // Enter alone should send
      await waitFor(() => {
        expect(api.sendChatMessage).toHaveBeenCalledWith(
          "thread-1",
          "Hello",
          "Test article content"
        );
      });
    });
  });

  describe("send button disabled state", () => {
    it("disables send button when input is empty", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it("enables send button when input has text", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);

      render(<ChatTab article={mockArticle} />);

      const newChatButton = screen.getByRole("button", { name: /new chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).not.toBeDisabled();
    });
  });
});
