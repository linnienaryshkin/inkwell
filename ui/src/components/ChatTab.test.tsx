import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChatTab from "./ChatTab";
import * as chatService from "@/services/chat";

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

  describe("List View", () => {
    it("should render thread list view on mount", async () => {
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
        expect(screen.getByText("No chats yet. Start a new one!")).toBeInTheDocument();
      });
    });

    it("should render 'New Chat +' button", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /New Chat/ })).toBeInTheDocument();
      });
    });

    it("should handle fetch error gracefully", async () => {
      mockChatService.fetchThreads.mockRejectedValue(new Error("Network error"));

      render(<ChatTab />);

      await waitFor(() => {
        expect(screen.getByText("No chats yet. Start a new one!")).toBeInTheDocument();
      });
    });
  });

  describe("Thread Creation", () => {
    it("should switch to thread view when clicking New Chat", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      const newChatButton = await screen.findByRole("button", { name: /New Chat/ });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Ask for writing feedback/)).toBeInTheDocument();
      });
    });

    it("should switch to thread view when selecting a thread", async () => {
      mockChatService.fetchThreads.mockResolvedValue([
        { thread_id: "1", preview: "Test question" },
      ]);

      render(<ChatTab />);

      const threadButton = await screen.findByRole("button", { name: /Test question/ });
      fireEvent.click(threadButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Ask for writing feedback/)).toBeInTheDocument();
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

      const newChatButton = await screen.findByRole("button", { name: /New Chat/ });
      fireEvent.click(newChatButton);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "Test message" } });

      const sendButton = screen.getByRole("button", { name: /Send/ });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockChatService.createThread).toHaveBeenCalledWith("Test message");
        expect(screen.getByText("Test message")).toBeInTheDocument();
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

      const sendButton = screen.getByRole("button", { name: /Send/ });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockChatService.sendMessage).toHaveBeenCalledWith("1", "Follow-up");
        expect(screen.getByText("Follow-up")).toBeInTheDocument();
        expect(screen.getByText("Follow-up response")).toBeInTheDocument();
      });
    });

    it("should not send empty message", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      const newChatButton = await screen.findByRole("button", { name: /New Chat/ });
      fireEvent.click(newChatButton);

      const sendButton = await screen.findByRole("button", { name: /Send/ });
      expect(sendButton).toBeDisabled();
    });

    it("should handle send error", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);
      mockChatService.createThread.mockRejectedValue(new Error("Send failed"));

      render(<ChatTab />);

      const newChatButton = await screen.findByRole("button", { name: /New Chat/ });
      fireEvent.click(newChatButton);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.change(textarea, { target: { value: "Test message" } });

      const sendButton = screen.getByRole("button", { name: /Send/ });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("Send failed")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should go back to list view", async () => {
      mockChatService.fetchThreads.mockResolvedValue([]);

      render(<ChatTab />);

      const newChatButton = await screen.findByRole("button", { name: /New Chat/ });
      fireEvent.click(newChatButton);

      const backButton = await screen.findByRole("button", { name: /Back/ });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /New Chat/ })).toBeInTheDocument();
      });
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

      const newChatButton = await screen.findByRole("button", { name: /New Chat/ });
      fireEvent.click(newChatButton);

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

      const newChatButton = await screen.findByRole("button", { name: /New Chat/ });
      fireEvent.click(newChatButton);

      const textarea = await screen.findByPlaceholderText(/Ask for writing feedback/);
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

      await waitFor(() => {
        expect(mockChatService.createThread).not.toHaveBeenCalled();
      });
    });
  });
});
