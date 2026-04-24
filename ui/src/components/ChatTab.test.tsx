import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChatTab from "./ChatTab";
import * as chatService from "@/services/chat";

// Mock ESM-only packages that Jest cannot transform
jest.mock("react-markdown", () => {
  return function DummyMarkdown({
    children,
    components,
  }: {
    children: string;
    components?: {
      p?: (props: { children: string }) => React.ReactNode;
      code?: (props: { children: string }) => React.ReactNode;
      pre?: (props: { children: React.ReactNode }) => React.ReactNode;
    };
  }) {
    if (typeof children === "string" && children.includes("`")) {
      // Inline code: `foo`
      const inlineMatch = children.match(/`([^`]+)`/);
      if (inlineMatch && components?.code) {
        const codeEl = components.code({ children: inlineMatch[1] });
        return <span>{codeEl}</span>;
      }
    }
    if (typeof children === "string" && children.includes("```")) {
      // Code block
      const blockMatch = children.match(/```\w*\n([\s\S]*?)\n```/);
      if (blockMatch && components?.pre && components?.code) {
        const codeEl = components.code({ children: blockMatch[1] });
        const preEl = components.pre({ children: codeEl });
        return <span>{preEl}</span>;
      }
    }
    return <span>{children}</span>;
  };
});
jest.mock("remark-gfm", () => ({}));

// Mock the chat service
jest.mock("@/services/chat");

const mockChatService = chatService as jest.Mocked<typeof chatService>;

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe("ChatTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
  });

  describe("Thread List Display", () => {
    it("should render thread list on mount", async () => {
      mockChatService.fetchThreads.mockResolvedValue([
        { thread_id: "1", preview: "What is TypeScript?" },
        { thread_id: "2", preview: "How to use React?" },
      ]);

      render(<ChatTab />);

      await waitFor(() => {
        expect(screen.getByText("What is TypeScript?")).toBeInTheDocument();
        expect(screen.getByText("How to use React?")).toBeInTheDocument();
      });
    });

    it("should show empty state when no threads exist", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      await waitFor(() => {
        expect(screen.getByText("No threads yet")).toBeInTheDocument();
      });
    });

    it("should handle fetch error gracefully", async () => {
      mockChatService.fetchThreads.mockRejectedValue(new Error("Network error"));

      render(<ChatTab />);

      await waitFor(() => {
        expect(screen.getByText("No threads yet")).toBeInTheDocument();
      });
    });
  });

  describe("Thread Selection", () => {
    it("should select thread and show its title with back button", async () => {
      mockChatService.fetchThreads.mockResolvedValue([
        { thread_id: "1", preview: "Test question" },
      ]);

      render(<ChatTab />);

      const threadButton = await screen.findByRole("button", { name: /Test question/ });
      fireEvent.click(threadButton);

      await waitFor(() => {
        // Back button should appear
        expect(screen.getByTitle("Back to all threads")).toBeInTheDocument();
        // Thread title should appear in header
        const threadTexts = screen.getAllByText("Test question");
        expect(threadTexts.length).toBeGreaterThan(0);
      });
    });

    it("should show 'Start the conversation' when thread selected but no messages", async () => {
      mockChatService.fetchThreads.mockResolvedValue([{ thread_id: "1", preview: "Test thread" }]);

      render(<ChatTab />);

      const threadButton = await screen.findByRole("button", { name: /Test thread/ });
      fireEvent.click(threadButton);

      await waitFor(() => {
        expect(screen.getByText("Start the conversation")).toBeInTheDocument();
      });
    });

    it("should hide thread list when thread is selected", async () => {
      mockChatService.fetchThreads.mockResolvedValue([
        { thread_id: "1", preview: "Thread 1" },
        { thread_id: "2", preview: "Thread 2" },
      ]);

      render(<ChatTab />);

      // Initially, thread list is visible
      const thread1Button = await screen.findByRole("button", { name: /Thread 1/ });
      expect(thread1Button).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Thread 2/ })).toBeInTheDocument();

      fireEvent.click(thread1Button);

      // After selecting a thread, thread list should be hidden
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /Thread 2/ })).not.toBeInTheDocument();
      });
    });

    it("should go back to thread list", async () => {
      mockChatService.fetchThreads.mockResolvedValue([{ thread_id: "1", preview: "Thread 1" }]);

      render(<ChatTab />);

      const threadButton = await screen.findByRole("button", { name: /Thread 1/ });
      fireEvent.click(threadButton);

      const backButton = await screen.findByTitle("Back to all threads");
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.queryByTitle("Back to all threads")).not.toBeInTheDocument();
      });
    });
  });

  describe("Message Sending", () => {
    it("should send message and create new thread", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);
      mockChatService.createThread.mockResolvedValue({
        thread_id: "new-id",
        reply: "AI response",
      });

      render(<ChatTab />);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "Test message" } });

      const sendButton = screen.getByTitle("Send message (Enter)");
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockChatService.createThread).toHaveBeenCalledWith("Test message");
      });

      await waitFor(() => {
        expect(screen.getByText("AI response")).toBeInTheDocument();
      });
    });

    it("should send message to existing thread", async () => {
      mockChatService.fetchThreads.mockResolvedValue([
        { thread_id: "1", preview: "Existing thread" },
      ]);
      mockChatService.sendMessage.mockResolvedValue({
        thread_id: "1",
        reply: "Follow-up response",
      });

      render(<ChatTab />);

      const threadButton = await screen.findByRole("button", { name: /Existing thread/ });
      fireEvent.click(threadButton);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "Follow-up" } });

      const sendButton = screen.getByTitle("Send message (Enter)");
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockChatService.sendMessage).toHaveBeenCalledWith("1", "Follow-up");
        expect(screen.getByText("Follow-up response")).toBeInTheDocument();
      });
    });

    it("should not send empty message", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      const sendButton = screen.getByTitle("Send message (Enter)");
      expect(sendButton).toBeDisabled();
    });

    it("should handle send error", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);
      mockChatService.createThread.mockRejectedValue(new Error("Send failed"));

      render(<ChatTab />);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "Test message" } });

      const sendButton = screen.getByTitle("Send message (Enter)");
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("Send failed")).toBeInTheDocument();
      });
    });
  });

  describe("Chat Form Always Visible", () => {
    it("should always show chat input and send button", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Ask for writing feedback/)).toBeInTheDocument();
        expect(screen.getByTitle("Send message (Enter)")).toBeInTheDocument();
      });
    });

    it("should allow typing in chat form without selecting a thread", async () => {
      mockChatService.fetchThreads.mockResolvedValue([{ thread_id: "1", preview: "Thread 1" }]);

      render(<ChatTab />);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "New message" } });

      expect(textarea).toHaveValue("New message");
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should send on Enter key", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);
      mockChatService.createThread.mockResolvedValue({
        thread_id: "1",
        reply: "Response",
      });

      render(<ChatTab />);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "Message" } });
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

      await waitFor(() => {
        expect(mockChatService.createThread).toHaveBeenCalledWith("Message");
      });
    });

    it("should not send on Shift+Enter", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

      await waitFor(() => {
        expect(mockChatService.createThread).not.toHaveBeenCalled();
      });
    });
  });

  describe("Markdown Rendering", () => {
    it("should render inline code in assistant messages", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);
      mockChatService.createThread.mockResolvedValue({
        thread_id: "1",
        reply: "Use `useState` hook",
      });

      render(<ChatTab />);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "How do I use state?" } });
      fireEvent.click(screen.getByTitle("Send message (Enter)"));

      await waitFor(() => {
        expect(screen.getByText("useState")).toBeInTheDocument();
      });
    });

    it("should render code blocks in assistant messages", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);
      mockChatService.createThread.mockResolvedValue({
        thread_id: "1",
        reply: "```\nconst x = 1\n```",
      });

      render(<ChatTab />);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "Show me code" } });
      fireEvent.click(screen.getByTitle("Send message (Enter)"));

      await waitFor(() => {
        expect(screen.getByText("const x = 1")).toBeInTheDocument();
      });
    });
  });
});
