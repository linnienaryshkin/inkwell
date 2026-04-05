import { fetchArticles, fetchArticle, patchArticle, getLoginUrl, logout } from "@/services/api";

const mockMetas = [
  {
    slug: "test-article",
    title: "Test Article",
    status: "draft" as const,
    tags: ["test"],
  },
];

const mockArticle = {
  slug: "test-article",
  content: "# Test",
  meta: {
    slug: "test-article",
    title: "Test Article",
    status: "draft" as const,
    tags: ["test"],
  },
  versions: [],
};

describe("getLoginUrl", () => {
  it("builds login URL with encoded redirect_url from window.location.origin + BASE_URL", () => {
    // jsdom sets window.location.origin to "http://localhost" by default
    // BASE_URL is "/" in Jest (import.meta.env.BASE_URL mock returns "/")
    const url = getLoginUrl();
    expect(url).toMatch(/^http:\/\/localhost:8000\/auth\/login\?redirect_url=/);
    expect(url).toContain(encodeURIComponent(window.location.origin));
  });
});

describe("api service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("fetchArticles", () => {
    it("should fetch article metas from the API", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMetas),
      });

      const result = await fetchArticles();

      expect(result).toEqual(mockMetas);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/articles",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it("should throw on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(fetchArticles()).rejects.toThrow("Failed to fetch articles: 500");
    });

    it("should throw on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(fetchArticles()).rejects.toThrow("Network error");
    });
  });

  describe("fetchArticle", () => {
    it("should fetch a single article by slug", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArticle),
      });

      const result = await fetchArticle("test-article");

      expect(result).toEqual(mockArticle);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/articles/test-article",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it("should URL-encode the slug", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArticle),
      });

      await fetchArticle("hello world");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/articles/hello%20world",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it("should throw on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(fetchArticle("missing")).rejects.toThrow("Failed to fetch article: 404");
    });

    it("should throw on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(fetchArticle("test-article")).rejects.toThrow("Network error");
    });
  });

  describe("patchArticle", () => {
    it("should send PATCH request with JSON body", async () => {
      const updated = { ...mockArticle, meta: { ...mockArticle.meta, title: "Updated" } };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updated),
      });

      const result = await patchArticle("test-article", {
        meta: { ...mockArticle.meta, title: "Updated" },
      });

      expect(result).toEqual(updated);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/articles/test-article",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should throw on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(patchArticle("missing", {})).rejects.toThrow("Failed to patch article: 404");
    });
  });

  describe("logout", () => {
    it("sends POST to /auth/logout with credentials: include", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/auth/logout",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("resolves on 204", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await expect(logout()).resolves.toBeUndefined();
    });

    it("throws on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

      await expect(logout()).rejects.toThrow("Logout failed: 403");
    });

    it("throws on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(logout()).rejects.toThrow("Network error");
    });
  });
});
