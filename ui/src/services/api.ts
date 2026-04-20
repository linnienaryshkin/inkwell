import type { Article, ArticleMeta } from "@/app/studio/page";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const TIMEOUT_MS = 3000;
const TIMEOUT_MS_CHAT = 30000;

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export type AuthUser = {
  login: string;
  name: string | null;
  avatar_url: string;
};

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await fetchWithTimeout(`${API_BASE}/auth/me`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Not authenticated");
  return response.json() as Promise<AuthUser>;
}

export function getLoginUrl(): string {
  const redirectUrl = window.location.origin + import.meta.env.BASE_URL;
  return `${API_BASE}/auth/login?redirect_url=${encodeURIComponent(redirectUrl)}`;
}

export async function fetchArticles(): Promise<ArticleMeta[]> {
  const response = await fetchWithTimeout(`${API_BASE}/articles`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to fetch articles: ${response.status}`);
  return response.json() as Promise<ArticleMeta[]>;
}

export async function fetchArticle(slug: string): Promise<Article> {
  const res = await fetchWithTimeout(`${API_BASE}/articles/${encodeURIComponent(slug)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch article: ${res.status}`);
  return res.json() as Promise<Article>;
}

export async function logout(): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Logout failed: ${response.status}`);
}

export async function patchArticle(slug: string, patch: Partial<Article>): Promise<Article> {
  const response = await fetchWithTimeout(`${API_BASE}/articles/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to patch article: ${response.status}`);
  return response.json() as Promise<Article>;
}

export async function createArticle(
  title: string,
  slug: string,
  tags: string[],
  content: string
): Promise<Article> {
  const response = await fetchWithTimeout(`${API_BASE}/articles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, slug, tags, content }),
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to create article");
  }
  return response.json() as Promise<Article>;
}

export async function deleteArticle(slug: string): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/articles/${encodeURIComponent(slug)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to delete article");
  }
}

export async function saveArticle(
  slug: string,
  patch: { title: string; tags: string[]; content: string; message?: string }
): Promise<Article> {
  const response = await fetchWithTimeout(`${API_BASE}/articles/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to save article");
  }
  return response.json() as Promise<Article>;
}

export type ChatMessage = { role: "human" | "ai"; content: string };

export type ChatThread = {
  thread_id: string;
  title: string;
  created_at: string;
};

export type ChatResponse = {
  thread_id: string;
  reply: string;
  history: ChatMessage[];
};

export async function fetchChatThreads(): Promise<ChatThread[]> {
  const response = await fetchWithTimeout(`${API_BASE}/chat/threads`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to fetch threads: ${response.status}`);
  return response.json() as Promise<ChatThread[]>;
}

export async function createChatThread(
  content: string,
  articleContent: string
): Promise<ChatThread> {
  const response = await fetchWithTimeout(`${API_BASE}/chat/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, article_content: articleContent }),
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to create thread: ${response.status}`);
  return response.json() as Promise<ChatThread>;
}

export async function getThreadDetail(
  threadId: string
): Promise<ChatThread & { history: ChatMessage[] }> {
  const response = await fetchWithTimeout(
    `${API_BASE}/chat/threads/${encodeURIComponent(threadId)}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) throw new Error(`Failed to fetch thread: ${response.status}`);
  return response.json() as Promise<ChatThread & { history: ChatMessage[] }>;
}

export async function sendChatMessage(
  threadId: string,
  content: string,
  articleContent: string
): Promise<ChatResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/chat/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, article_content: articleContent }),
      credentials: "include",
    },
    TIMEOUT_MS_CHAT
  );
  if (!response.ok) throw new Error(`Failed to send message: ${response.status}`);
  return response.json() as Promise<ChatResponse>;
}
