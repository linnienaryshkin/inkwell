"use client";

import { useEffect, useRef, useState } from "react";
import type { Article } from "@/app/studio/page";
import {
  createChatThread,
  fetchChatThreads,
  getThreadDetail,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
} from "@/services/api";

type View = { kind: "threads"; input: string } | { kind: "thread"; threadId: string };

export function ChatTab({ article }: { article: Article | null }) {
  const [view, setView] = useState<View>({ kind: "threads", input: "" });
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [threadInput, setThreadInput] = useState("");
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
    loadThreads();
    setView({ kind: "threads", input: "" });
  }, [article?.slug]);

  const loadThreads = async () => {
    try {
      setError(null);
      const data = await fetchChatThreads();
      setThreads(data);
    } catch {
      setError("Failed to load threads");
    }
  };

  const handleSendMessageFromThreads = async () => {
    if (!article || view.kind !== "threads" || view.input.trim() === "") return;

    setLoading(true);
    setError(null);

    try {
      const thread = await createChatThread(view.input, article.content);
      setView({ kind: "thread", threadId: thread.thread_id });
      // Fetch the thread detail to get the full history including AI response
      const threadDetail = await getThreadDetail(thread.thread_id);
      setHistory(threadDetail.history);
      setThreadInput("");
      await loadThreads();
    } catch {
      setError("Failed to create thread");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!article || threadInput.trim() === "" || view.kind !== "thread") return;

    const threadId = view.threadId;
    setLoading(true);
    setError(null);

    try {
      await sendChatMessage(threadId, threadInput, article.content);
      // Fetch updated thread detail to get the latest history
      const threadDetail = await getThreadDetail(threadId);
      setHistory(threadDetail.history);
      setThreadInput("");
      // Reload threads to reflect any updated titles
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
        className="p-4 flex flex-col gap-4 h-full"
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

        {/* Scrollable threads list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 pr-2">
          {threads.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-secondary)" }}>
              No threads yet
            </p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.thread_id}
                onClick={() => setView({ kind: "thread", threadId: thread.thread_id })}
                className="text-left p-3 rounded transition-opacity"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderLeft: "2px solid var(--accent)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
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
            ))
          )}
        </div>

        {/* Input area for new chat */}
        <div
          className="flex flex-col gap-2 border-t"
          style={{ borderColor: "var(--border)", paddingTop: "1rem" }}
        >
          <textarea
            value={view.input}
            onChange={(e) => setView({ kind: "threads", input: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessageFromThreads();
              }
            }}
            disabled={loading}
            placeholder="Type Message..."
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
            onClick={handleSendMessageFromThreads}
            disabled={loading || view.input.trim() === ""}
            className="w-full py-2 text-sm rounded font-medium transition-all"
            style={{
              background:
                loading || view.input.trim() === "" ? "var(--text-secondary)" : "var(--accent)",
              color:
                loading || view.input.trim() === "" ? "var(--text-secondary)" : "var(--bg-primary)",
              cursor: loading || view.input.trim() === "" ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.opacity = "0.9";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    );
  }

  // Thread view
  return (
    <div className="p-4 flex flex-col h-full" style={{ backgroundColor: "var(--bg-secondary)" }}>
      {/* Back button and header */}
      <button
        onClick={() => setView({ kind: "threads", input: "" })}
        className="mb-4 text-sm transition-opacity"
        style={{ color: "var(--accent)", cursor: "pointer" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
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
          value={threadInput}
          onChange={(e) => setThreadInput(e.target.value)}
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
          disabled={loading || threadInput.trim() === ""}
          className="w-full py-2 text-sm rounded font-medium transition-all"
          style={{
            background:
              loading || threadInput.trim() === "" ? "var(--text-secondary)" : "var(--accent)",
            color:
              loading || threadInput.trim() === "" ? "var(--text-secondary)" : "var(--bg-primary)",
            cursor: loading || threadInput.trim() === "" ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.opacity = "0.9";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
