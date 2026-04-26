export type ThreadPreview = {
  thread_id: string;
  preview: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ThreadDetail = {
  thread_id: string;
  preview: string;
  messages: ChatMessage[];
};

export type ChatResponse = {
  thread_id: string;
  reply: string;
};

import { API_BASE } from "@/services/api";

const API_URL = `${API_BASE}/ai`;
const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      credentials: "include",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchThreads(): Promise<ThreadPreview[]> {
  const response = await fetchWithTimeout(`${API_URL}/threads`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch threads (${response.status})`);
  }

  return response.json();
}

export async function fetchThread(threadId: string): Promise<ThreadDetail> {
  const response = await fetchWithTimeout(`${API_URL}/threads/${threadId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch thread (${response.status})`);
  }

  return response.json();
}

export async function createThread(message: string): Promise<ChatResponse> {
  const response = await fetchWithTimeout(`${API_URL}/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create thread (${response.status})`);
  }

  return response.json();
}

export async function sendMessage(threadId: string, message: string): Promise<ChatResponse> {
  const response = await fetchWithTimeout(`${API_URL}/threads/${threadId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to send message (${response.status})`);
  }

  return response.json();
}
