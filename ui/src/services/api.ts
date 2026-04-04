import type { Article } from "@/app/studio/page";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const TIMEOUT_MS = 3000;

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

export async function fetchArticles(): Promise<Article[]> {
  const response = await fetchWithTimeout(`${API_BASE}/articles`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to fetch articles: ${response.status}`);
  return response.json() as Promise<Article[]>;
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
