import { useEffect, useRef, useState } from "react";
import {
  ChatResponse,
  ThreadPreview,
  createThread,
  fetchThreads,
  sendMessage,
} from "@/services/chat";

type View = "list" | "thread";
type Message = { role: "user" | "assistant"; content: string };

export default function ChatTab() {
  const [view, setView] = useState<View>("list");
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads on mount
  useEffect(() => {
    const loadThreads = async () => {
      try {
        const data = await fetchThreads();
        setThreads(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load threads");
      }
    };

    loadThreads();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    setView("thread");
    setActiveThreadId(null);
    setMessages([]);
    setError(null);
  };

  const handleSelectThread = (thread: ThreadPreview) => {
    setView("thread");
    setActiveThreadId(thread.thread_id);
    setMessages([]);
    setError(null);
  };

  const handleBack = () => {
    setView("list");
    setActiveThreadId(null);
    setMessages([]);
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    setInputValue("");
    setLoading(true);
    setError(null);

    try {
      // Optimistically add user message
      setMessages((prev) => [...prev, { role: "user", content: text }]);

      let response: ChatResponse;

      if (activeThreadId === null) {
        // Create new thread
        response = await createThread(text);
        setActiveThreadId(response.thread_id);

        // Add new thread to list
        setThreads((prev) => [{ thread_id: response.thread_id, preview: text }, ...prev]);
      } else {
        // Send to existing thread
        response = await sendMessage(activeThreadId, text);
      }

      // Add assistant reply
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMsg);
      // Remove optimistic user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (view === "list") {
    return (
      <div className="flex flex-col gap-4 h-full">
        <button
          onClick={handleNewChat}
          className="px-4 py-2 rounded border border-accent text-accent hover:bg-accent hover:text-white transition-colors"
        >
          + New Chat
        </button>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="text-text-secondary text-sm">No chats yet. Start a new one!</p>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.thread_id}
                  onClick={() => handleSelectThread(thread)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-bg-tertiary transition-colors"
                >
                  <p className="text-sm text-text-primary truncate">{thread.preview}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Thread view
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <button
        onClick={handleBack}
        className="text-accent hover:text-accent-hover transition-colors text-sm"
      >
        ← Back
      </button>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded text-sm ${
                msg.role === "user"
                  ? "bg-bg-tertiary text-text-primary"
                  : "border border-border bg-bg-primary text-text-primary"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="text-sm text-text-secondary italic">Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && <div className="px-3 py-2 bg-red rounded text-white text-sm">{error}</div>}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Ask for writing feedback..."
          className="flex-1 px-3 py-2 rounded border border-border bg-bg-primary text-text-primary placeholder-text-secondary resize-none"
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={loading || !inputValue.trim()}
          className="px-4 py-2 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
