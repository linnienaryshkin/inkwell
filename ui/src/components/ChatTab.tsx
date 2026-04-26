import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChatMessage,
  ChatResponse,
  ThreadPreview,
  createThread,
  fetchThread,
  fetchThreads,
  sendMessage,
} from "@/services/chat";

type Message = ChatMessage;

export default function ChatTab() {
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

  const handleSelectThread = async (thread: ThreadPreview) => {
    setActiveThreadId(thread.thread_id);
    setMessages([]);
    setError(null);
    setLoading(true);

    try {
      const detail = await fetchThread(thread.thread_id);
      setMessages(detail.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread history");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveThreadId(null);
    setMessages([]);
    setError(null);
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

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top: Thread List (hidden when a thread is selected) */}
      {!activeThreadId && (
        <div className="flex-shrink-0">
          <div style={{ maxHeight: 96, overflow: "hidden" }} className="space-y-1">
            {threads.length === 0 ? (
              <p className="text-text-secondary text-xs px-2">No threads yet</p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.thread_id}
                  onClick={() => handleSelectThread(thread)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all duration-200 cursor-pointer ${
                    activeThreadId === thread.thread_id
                      ? "bg-accent"
                      : "text-text-primary hover:bg-bg-tertiary hover:text-accent active:scale-95"
                  }`}
                  style={
                    activeThreadId === thread.thread_id ? { color: "var(--bg-primary)" } : undefined
                  }
                >
                  <p className="truncate">{thread.preview}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Middle: Message Thread */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeThreadId ? (
          <>
            {/* Thread header with back button */}
            <div
              className="flex-shrink-0 pb-2 border-b flex items-center gap-2"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={handleBack}
                className="text-accent hover:text-accent-hover hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer text-sm"
                title="Back to all threads"
                aria-label="Back to all threads"
              >
                ←
              </button>
              <p className="text-xs font-semibold text-text-secondary truncate">
                {threads.find((t) => t.thread_id === activeThreadId)?.preview || "Thread"}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 py-2">
              {messages.length === 0 && !loading && (
                <p className="text-text-secondary text-xs text-center py-4">
                  Start the conversation
                </p>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`px-3 py-2 rounded text-sm ${
                      msg.role === "user"
                        ? "bg-accent"
                        : "border border-border bg-bg-primary text-text-primary"
                    }`}
                    style={{
                      maxWidth: "85%",
                      ...(msg.role === "user" ? { color: "var(--bg-primary)" } : {}),
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        code: ({ children }) => (
                          <code
                            className="px-1 rounded text-xs font-mono"
                            style={{ background: "var(--bg-tertiary)" }}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre
                            className="p-2 rounded text-xs font-mono overflow-x-auto mt-1 mb-1"
                            style={{ background: "var(--bg-tertiary)" }}
                          >
                            {children}
                          </pre>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-secondary text-sm">
              {threads.length === 0 ? "Start typing to create your first chat" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Bottom: Always visible chat form */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        {error && (
          <div className="px-3 py-2 bg-red rounded text-sm" style={{ color: "var(--bg-primary)" }}>
            {error}
          </div>
        )}
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
            className="rounded bg-accent hover:bg-accent-hover hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer flex items-center justify-center"
            style={{
              color: "var(--bg-primary)",
              padding: "8px 14px",
              fontSize: 16,
              fontWeight: 600,
            }}
            title="Send message (Enter)"
            aria-label="Send message (Enter)"
          >
            {loading ? "..." : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
}
