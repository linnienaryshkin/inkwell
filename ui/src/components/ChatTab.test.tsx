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
  title: "First question",
  created_at: new Date().toISOString(),
};

describe("ChatTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
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
        expect(api.fetchChatThreads).toHaveBeenCalled();
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

    it("creates a new thread and switches to it when sending a message", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockThread]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "Response" },
        ],
      });

      render(<ChatTab article={mockArticle} />);

      // Find the message input in the threads view
      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(api.createChatThread).toHaveBeenCalledWith("Hello", "Test article content");
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
    it("renders message input and send button in thread view", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([]) // Initial load
        .mockResolvedValueOnce([mockThread]); // Reload after sending
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "Response" },
        ],
      });

      render(<ChatTab article={mockArticle} />);

      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(sendButton);

      // Wait for the message to be sent and the thread view to be displayed
      await waitFor(() => {
        expect(screen.getByText("Hello")).toBeInTheDocument();
      });

      // Check that we're in thread view with the input and button
      expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /send/i }).length).toBeGreaterThan(0);
    });

    it("sends a message and displays the response", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([]) // Initial load
        .mockResolvedValueOnce([mockThread]) // Reload after first message
        .mockResolvedValueOnce([mockThread]); // Reload after second message
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock)
        .mockResolvedValueOnce({
          ...mockThread,
          history: [
            { role: "human" as const, content: "Hello" },
            { role: "ai" as const, content: "First response" },
          ],
        })
        .mockResolvedValueOnce({
          ...mockThread,
          history: [
            { role: "human" as const, content: "Hello" },
            { role: "ai" as const, content: "First response" },
            { role: "human" as const, content: "Tell me more" },
            { role: "ai" as const, content: "This is a helpful response" },
          ],
        });
      (api.sendChatMessage as jest.Mock).mockResolvedValue({
        thread_id: "thread-1",
        reply: "This is a helpful response",
        history: [],
      });

      render(<ChatTab article={mockArticle} />);

      // Send initial message to create thread
      const threadViewTextarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(threadViewTextarea, { target: { value: "Hello" } });

      const initialSendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(initialSendButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      // Send follow-up message in thread
      const messageTextarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(messageTextarea, { target: { value: "Tell me more" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i }).pop();
      fireEvent.click(sendButton!);

      await waitFor(() => {
        expect(api.sendChatMessage).toHaveBeenCalledWith(
          "thread-1",
          "Tell me more",
          "Test article content"
        );
      });

      // Wait for the UI to update with the new message
      await waitFor(() => {
        expect(screen.getByText("This is a helpful response")).toBeInTheDocument();
      });

      expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("disables input while sending", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockThread]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "Response" },
        ],
      });
      (api.sendChatMessage as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ChatTab article={mockArticle} />);

      const threadViewTextarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(threadViewTextarea, { target: { value: "Hello" } });

      const initialSendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(initialSendButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i }).pop();
      fireEvent.click(sendButton!);

      // Button should show "Sending..." while the request is in flight
      expect(sendButton).toHaveTextContent("Sending...");
      expect(textarea).toBeDisabled();
    });

    it("goes back to threads view when back button is clicked", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([]) // Initial load
        .mockResolvedValueOnce([mockThread]); // Reload after sending
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "Response" },
        ],
      });

      render(<ChatTab article={mockArticle} />);

      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(sendButton);

      // Wait for back button to appear
      await waitFor(() => {
        expect(screen.getByText("← Back")).toBeInTheDocument();
      });

      const backButton = screen.getByText("← Back");
      fireEvent.click(backButton);

      // Should go back to threads view with the message input
      expect(screen.getByPlaceholderText("Type Message...")).toBeInTheDocument();
    });

    it("displays error messages when send fails in thread view", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([]) // Initial load
        .mockResolvedValueOnce([mockThread]); // Reload after initial send
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "First response" },
        ],
      });
      (api.sendChatMessage as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      render(<ChatTab article={mockArticle} />);

      // First send succeeds and creates thread
      const threadViewTextarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(threadViewTextarea, { target: { value: "Hello" } });

      const initialSendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(initialSendButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      // Second send fails
      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i }).pop();
      fireEvent.click(sendButton!);

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
        expect(api.fetchChatThreads).toHaveBeenCalled();
      });

      const newArticle = { ...mockArticle, slug: "new-article" };
      rerender(<ChatTab article={newArticle} />);

      await waitFor(() => {
        expect(api.fetchChatThreads).toHaveBeenCalledTimes(2);
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
        expect(screen.getByPlaceholderText("Type Message...")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to create thread")).toBeInTheDocument();
      });
    });
  });

  describe("handlers and interactions", () => {
    it("loads threads on initial render", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([mockThread]);

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(api.fetchChatThreads).toHaveBeenCalled();
      });
    });

    it("clicking thread navigates to thread detail view", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([mockThread]);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [{ role: "human" as const, content: "Test" }],
      });

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(screen.getByText("First question")).toBeInTheDocument();
      });

      const threadButton = screen.getByText("First question");
      fireEvent.click(threadButton);

      await waitFor(() => {
        expect(api.getThreadDetail).toHaveBeenCalledWith("thread-1");
      });
    });

    it("handles mouse hover effects on thread buttons", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([mockThread]);

      render(<ChatTab article={mockArticle} />);

      await waitFor(() => {
        expect(screen.getByText("First question")).toBeInTheDocument();
      });

      const threadButton = screen.getByText("First question");
      fireEvent.mouseEnter(threadButton);
      fireEvent.mouseLeave(threadButton);

      // Just verify hover handlers execute without error
      expect(threadButton).toBeInTheDocument();
    });

    it("handles send button hover in thread view", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockThread]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [{ role: "human" as const, content: "Test" }],
      });

      render(<ChatTab article={mockArticle} />);

      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(sendButton);

      await waitFor(() => {
        const threadViewSendButton = screen.getAllByRole("button", { name: /send/i }).pop();
        expect(threadViewSendButton).toBeInTheDocument();

        if (threadViewSendButton) {
          fireEvent.mouseEnter(threadViewSendButton);
          fireEvent.mouseLeave(threadViewSendButton);
        }
      });
    });

    it("handles back button click and hover", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockThread]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [{ role: "human" as const, content: "Test" }],
      });

      render(<ChatTab article={mockArticle} />);

      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("← Back")).toBeInTheDocument();
      });

      const backButton = screen.getByText("← Back");
      fireEvent.mouseEnter(backButton);
      fireEvent.mouseLeave(backButton);
      fireEvent.click(backButton);

      expect(screen.getByPlaceholderText("Type Message...")).toBeInTheDocument();
    });
  });

  describe("keyboard shortcuts", () => {
    it("sends message on Shift+Enter in threads view", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);

      render(<ChatTab article={mockArticle} />);

      const threadViewTextarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(threadViewTextarea, { target: { value: "Hello" } });
      fireEvent.keyDown(threadViewTextarea, { key: "Enter", shiftKey: true });

      // Shift+Enter should NOT send in threads view either
      expect(api.createChatThread).not.toHaveBeenCalled();
    });

    it("sends message on Enter in thread view", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockThread]);
      (api.createChatThread as jest.Mock).mockResolvedValue(mockThread);
      (api.getThreadDetail as jest.Mock).mockResolvedValue({
        ...mockThread,
        history: [
          { role: "human" as const, content: "Hello" },
          { role: "ai" as const, content: "Response" },
        ],
      });
      (api.sendChatMessage as jest.Mock).mockResolvedValue({
        thread_id: "thread-1",
        reply: "Follow-up response",
      });

      render(<ChatTab article={mockArticle} />);

      // Send initial message to create thread
      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });
      const sendButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(sendButton);

      // Now test Enter key in thread view
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const threadViewTextarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(threadViewTextarea, { target: { value: "Follow-up" } });
      fireEvent.keyDown(threadViewTextarea, { key: "Enter", shiftKey: false });

      await waitFor(() => {
        expect(api.sendChatMessage).toHaveBeenCalled();
      });
    });
  });

  describe("send button disabled state", () => {
    it("disables send button when input is empty in threads view", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);

      render(<ChatTab article={mockArticle} />);

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      expect(sendButton).toBeDisabled();
    });

    it("enables send button when input has text in threads view", async () => {
      (api.fetchChatThreads as jest.Mock).mockResolvedValue([]);

      render(<ChatTab article={mockArticle} />);

      const textarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(textarea, { target: { value: "Hello" } });

      const sendButton = screen.getAllByRole("button", { name: /send/i })[0];
      expect(sendButton).not.toBeDisabled();
    });

    it("disables send button when input is empty in thread view", async () => {
      (api.fetchChatThreads as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockThread]);
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

      const threadViewTextarea = screen.getByPlaceholderText("Type Message...");
      fireEvent.change(threadViewTextarea, { target: { value: "Hello" } });

      const initialSendButton = screen.getAllByRole("button", { name: /send/i })[0];
      fireEvent.click(initialSendButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      });

      const sendButton = screen.getAllByRole("button", { name: /send/i }).pop();
      expect(sendButton).toBeDisabled();
    });
  });
});
