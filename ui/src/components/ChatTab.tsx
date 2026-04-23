import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  createThread,
  fetchThreads,
  postMessage,
  type ChatMessage,
  type ThreadMeta,
} from "@/services/api";
import type { Article } from "@/app/studio/page";
import { markdownComponents } from "./MarkdownComponents";

type View = "threads" | "thread";

type Props = {
  article: Article | null;
};

export function ChatTab({ article }: Props) {
  const [view, setView] = useState<View>("threads");
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads when article changes
  useEffect(() => {
    if (!article) {
      setThreads([]);
      setView("threads");
      return;
    }

    setLoading(true);
    setError(null);
    fetchThreads(article.meta.slug)
      .then(setThreads)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [article]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!article) {
    return (
      <div
        className="p-4 flex flex-col gap-2 overflow-y-auto"
        style={{ height: "100%", color: "var(--text-secondary)", fontSize: "0.875rem" }}
      >
        Open an article to start chatting.
      </div>
    );
  }

  const handleNewThreadClick = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const { thread_id, reply } = await createThread({
        slug: article.meta.slug,
        message: input,
        article_content: article.content,
      });
      setActiveThreadId(thread_id);
      setMessages([
        { role: "user", content: input, created_at: new Date().toISOString() },
        {
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        },
      ]);
      setInput("");
      setView("thread");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !activeThreadId) return;

    setLoading(true);
    setError(null);
    try {
      const { reply } = await postMessage(activeThreadId, {
        message: input,
        article_content: article.content,
      });
      setMessages((prev) => [
        ...prev,
        { role: "user", content: input, created_at: new Date().toISOString() },
        {
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        },
      ]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (view === "threads") {
        handleNewThreadClick();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleThreadClick = (threadId: string) => {
    setActiveThreadId(threadId);
    setMessages([]);
    setView("thread");
  };

  const handleBackClick = () => {
    setView("threads");
  };

  const renderThreadButton = (thread: ThreadMeta) => (
    <button
      key={thread.id}
      onClick={() => handleThreadClick(thread.id)}
      style={{
        padding: "8px 12px",
        backgroundColor: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-primary)",
        fontSize: "0.875rem",
        transition: "background-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      <div style={{ fontWeight: 500 }}>{thread.title}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
        {new Date(thread.created_at).toLocaleDateString()}
      </div>
    </button>
  );

  const renderMessage = (msg: ChatMessage, idx: number) => (
    <div
      key={idx}
      style={{
        display: "flex",
        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
        marginBottom: "8px",
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "8px 12px",
          borderRadius: "6px",
          backgroundColor: msg.role === "user" ? "var(--accent)" : "var(--bg-tertiary)",
          color: msg.role === "user" ? "var(--bg-primary)" : "var(--text-primary)",
          fontSize: "0.875rem",
          lineHeight: "1.4",
        }}
      >
        {msg.role === "assistant" ? (
          <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
        ) : (
          msg.content
        )}
      </div>
    </div>
  );

  if (view === "threads") {
    return (
      <div
        className="p-4 flex flex-col gap-4 overflow-y-auto"
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Loading threads...
            </div>
          ) : threads.length === 0 ? (
            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              No threads yet. Create one to get started!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {threads.map((thread) => renderThreadButton(thread))}
            </div>
          )}
        </div>

        {/* New thread input */}
        <div className="flex flex-col gap-2">
          {error && <div style={{ color: "var(--red)", fontSize: "0.875rem" }}>{error}</div>}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about this article..."
            style={{
              padding: "8px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              fontFamily: "inherit",
              minHeight: "60px",
              resize: "none",
            }}
          />
          <button
            onClick={handleNewThreadClick}
            disabled={loading || !input.trim()}
            style={{
              padding: "8px 12px",
              backgroundColor: input.trim() && !loading ? "var(--accent)" : "var(--bg-tertiary)",
              color: input.trim() && !loading ? "var(--bg-primary)" : "var(--text-secondary)",
              border: "none",
              borderRadius: "4px",
              cursor: input.trim() && !loading ? "pointer" : "default",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
          >
            {loading ? "Creating..." : "New Thread"}
          </button>
        </div>
      </div>
    );
  }

  // Thread view
  return (
    <div
      className="flex flex-col"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Back button + thread header */}
      <div
        className="p-4"
        style={{
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <button
          onClick={handleBackClick}
          style={{
            padding: "4px 8px",
            backgroundColor: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
          }}
        >
          ← Back
        </button>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
          {activeThreadId && threads.find((t) => t.id === activeThreadId)?.title}
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        {loading && (
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              fontStyle: "italic",
            }}
          >
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="p-4"
        style={{
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {error && <div style={{ color: "var(--red)", fontSize: "0.875rem" }}>{error}</div>}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          style={{
            padding: "8px",
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            fontFamily: "inherit",
            minHeight: "50px",
            resize: "none",
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: "8px 12px",
            backgroundColor: input.trim() && !loading ? "var(--accent)" : "var(--bg-tertiary)",
            color: input.trim() && !loading ? "var(--bg-primary)" : "var(--text-secondary)",
            border: "none",
            borderRadius: "4px",
            cursor: input.trim() && !loading ? "pointer" : "default",
            fontSize: "0.875rem",
            fontWeight: 500,
            transition: "background-color 0.2s",
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
