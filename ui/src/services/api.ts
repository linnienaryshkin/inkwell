import type { Article, ArticleMeta } from "@/app/studio/page";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const TIMEOUT_MS = 3000;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ThreadMeta = {
  id: string;
  slug: string;
  title: string;
  created_at: string;
};

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
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

export async function fetchThreads(slug: string): Promise<ThreadMeta[]> {
  const response = await fetchWithTimeout(
    `${API_BASE}/ai/threads?slug=${encodeURIComponent(slug)}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) throw new Error(`Failed to fetch threads: ${response.status}`);
  return response.json() as Promise<ThreadMeta[]>;
}

export async function createThread(body: {
  slug: string;
  message: string;
  article_content: string;
}): Promise<{ thread_id: string; reply: string }> {
  const response = await fetchWithTimeout(`${API_BASE}/ai/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to create thread");
  }
  return response.json() as Promise<{ thread_id: string; reply: string }>;
}

export async function postMessage(
  threadId: string,
  body: { message: string; article_content: string }
): Promise<{ reply: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE}/ai/threads/${encodeURIComponent(threadId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to post message");
  }
  return response.json() as Promise<{ reply: string }>;
}
