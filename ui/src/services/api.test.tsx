import { fetchArticles, patchArticle, getLoginUrl } from "@/services/api";

const mockArticles = [
  {
    slug: "test-article",
    title: "Test Article",
    status: "draft" as const,
    content: "# Test",
    tags: ["test"],
  },
];

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
    it("should fetch articles from the API", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArticles),
      });

      const result = await fetchArticles();

      expect(result).toEqual(mockArticles);
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

  describe("patchArticle", () => {
    it("should send PATCH request with JSON body", async () => {
      const updated = { ...mockArticles[0], title: "Updated" };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updated),
      });

      const result = await patchArticle("test-article", { title: "Updated" });

      expect(result).toEqual(updated);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/articles/test-article",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        })
      );
    });

    it("should throw on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(patchArticle("missing", { title: "x" })).rejects.toThrow(
        "Failed to patch article: 404"
      );
    });
  });
});
