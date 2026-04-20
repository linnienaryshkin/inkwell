"use client";

import { useEffect, useRef, useState } from "react";
import type { Article } from "@/app/studio/page";
import {
  createChatThread,
  fetchChatThreads,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
} from "@/services/api";

type View = { kind: "threads" } | { kind: "thread"; threadId: string };

export function ChatTab({ article }: { article: Article | null }) {
  const [view, setView] = useState<View>({ kind: "threads" });
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when history updates
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [history]);

  // Load threads when article changes
  useEffect(() => {
    if (article) {
      loadThreads();
      setView({ kind: "threads" });
    }
  }, [article?.slug]);

  const loadThreads = async () => {
    if (!article) return;
    try {
      setError(null);
      const data = await fetchChatThreads(article.slug);
      setThreads(data);
    } catch {
      setError("Failed to load threads");
    }
  };

  const handleNewChat = async () => {
    if (!article) return;
    try {
      setError(null);
      const thread = await createChatThread(article.slug);
      setView({ kind: "thread", threadId: thread.thread_id });
      setHistory([]);
      setInput("");
    } catch {
      setError("Failed to create thread");
    }
  };

  const handleSendMessage = async () => {
    if (!article || input.trim() === "" || view.kind !== "thread") return;

    const threadId = view.threadId;
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(threadId, input, article.content);
      setHistory(response.history);
      setInput("");
      // Reload threads to reflect new title
      await loadThreads();
    } catch {
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (!article) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          Select an article to start chatting
        </p>
      </div>
    );
  }

  if (view.kind === "threads") {
    return (
      <div
        className="p-4 flex flex-col gap-4 h-full overflow-y-auto"
        style={{ backgroundColor: "var(--bg-secondary)" }}
      >
        {error && (
          <div
            className="text-xs p-2 rounded"
            style={{ backgroundColor: "#fee", color: "var(--red)" }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleNewChat}
          className="w-full py-2 text-sm rounded font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          New Chat
        </button>

        {threads.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: "var(--text-secondary)" }}>
            No threads yet
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {threads.map((thread) => (
              <button
                key={thread.thread_id}
                onClick={() => setView({ kind: "thread", threadId: thread.thread_id })}
                className="text-left p-3 rounded transition-colors hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderLeft: "2px solid var(--accent)",
                }}
              >
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {thread.title || "Untitled"}
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {new Date(thread.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Thread view
  return (
    <div className="p-4 flex flex-col h-full" style={{ backgroundColor: "var(--bg-secondary)" }}>
      {/* Back button and header */}
      <button
        onClick={() => setView({ kind: "threads" })}
        className="mb-4 text-sm"
        style={{ color: "var(--accent)" }}
      >
        ← Back
      </button>

      {error && (
        <div
          className="text-xs p-2 rounded mb-4"
          style={{ backgroundColor: "#fee", color: "var(--red)" }}
        >
          {error}
        </div>
      )}

      {/* Messages list */}
      <div
        className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1"
        style={{ color: "var(--text-primary)" }}
      >
        {history.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: "var(--text-secondary)" }}>
            Start the conversation
          </p>
        ) : (
          history.map((msg, idx) => (
            <div
              key={idx}
              className={`text-sm p-2 rounded ${msg.role === "human" ? "text-right" : "text-left"}`}
              style={{
                backgroundColor: msg.role === "human" ? "var(--accent)" : "var(--bg-primary)",
                color: msg.role === "human" ? "var(--bg-primary)" : "var(--text-primary)",
              }}
            >
              {msg.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={loading}
          placeholder="Type a message..."
          className="w-full p-2 rounded text-sm resize-none"
          style={{
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
            borderColor: "var(--border)",
            opacity: loading ? 0.6 : 1,
            border: "1px solid var(--border)",
          }}
          rows={3}
        />
        <button
          onClick={handleSendMessage}
          disabled={loading || input.trim() === ""}
          className="w-full py-2 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
