import { useState, useEffect, useCallback, useRef } from "react";
import { FaGithub } from "react-icons/fa";
import { ArticleList } from "@/components/ArticleList";
import { EditorPane } from "@/components/EditorPane";
import { SidePanel } from "@/components/SidePanel";
import { VersionStrip } from "@/components/VersionStrip";
import {
  fetchArticles,
  fetchArticle,
  fetchCurrentUser,
  getLoginUrl,
  logout,
  createArticle,
  saveArticle,
  deleteArticle,
} from "@/services/api";
import type { AuthUser } from "@/services/api";

export type ArticleVersion = {
  sha: string;
  message: string;
  committed_at: string;
};

export type ArticleMeta = {
  slug: string;
  title: string;
  status: "draft" | "published";
  tags: string[];
};

export type Article = {
  slug: string;
  content: string;
  meta: ArticleMeta;
  versions: ArticleVersion[];
};

const MOCK_ARTICLE: Article = {
  slug: "welcome",
  content: `# Welcome to Inkwell

Sign in with GitHub to unlock the full potential of the application.

Your articles are stored as files in your GitHub repository — version-controlled, diff-able, and always yours.
`,
  meta: {
    slug: "welcome",
    title: "Welcome to Inkwell",
    status: "draft",
    tags: [],
  },
  versions: [],
};

const MOCK_METAS: ArticleMeta[] = [MOCK_ARTICLE.meta];

const EMPTY_ARTICLE: Article = {
  slug: "__new__",
  content: "",
  meta: { slug: "__new__", title: "", status: "draft", tags: [] },
  versions: [],
};

function titleToSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function SignedOutLanding({
  theme,
  onToggleTheme,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-3">
          <h1
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 500,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              color: "var(--text-primary)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>$</span>
            <span>inkwell</span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 14,
                marginLeft: 2,
                background: "var(--text-primary)",
                animation: "inkwell-blink 1.06s steps(1, end) infinite",
              }}
            />
          </h1>
          <span
            style={{
              fontSize: 9,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
            }}
          >
            write · commit · publish
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/linnienaryshkin/inkwell"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit Inkwell GitHub repository"
            aria-label="Visit Inkwell GitHub repository"
            className="inline-flex items-center justify-center p-1 transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <FaGithub size={20} />
          </a>
          <button
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="text-xs px-2 py-1 rounded border"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
          <a
            href={getLoginUrl()}
            aria-label="Sign in with GitHub"
            className="inline-flex items-center gap-1 px-2 rounded text-sm"
            style={{
              background: "var(--accent)",
              color: "var(--bg-primary)",
              height: "40px",
              width: "180px",
              justifyContent: "center",
            }}
          >
            <FaGithub size={16} />
            Sign in with GitHub
          </a>
        </div>
      </header>

      {/* Landing body */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "var(--bg-primary)", padding: 48 }}
      >
        <div className="flex flex-col items-center gap-5 text-center" style={{ maxWidth: 520 }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--accent)",
              lineHeight: 1,
            }}
          >
            Inkwell
          </div>
          <p style={{ fontSize: 18, color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>
            A personal writing studio backed by your GitHub repo.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 440,
            }}
          >
            Articles are stored as files. Versions are commits. Lint, publish to dev.to, and export
            anywhere — all without leaving the editor.
          </p>
          <a
            href={getLoginUrl()}
            aria-label="Sign in with GitHub"
            className="inline-flex items-center gap-2 rounded font-medium"
            style={{
              padding: "12px 20px",
              fontSize: 15,
              background: "var(--accent)",
              color: "var(--bg-primary)",
              textDecoration: "none",
              marginTop: 8,
            }}
          >
            <FaGithub size={18} />
            Sign in with GitHub
          </a>
          <div
            className="flex gap-8 pt-6 border-t w-full justify-center"
            style={{ marginTop: 28, borderColor: "var(--border)" }}
          >
            {[
              { label: "Markdown editor", sub: "Monaco, with preview" },
              { label: "Git versions", sub: "Every save is a commit" },
              { label: "Multi-publish", sub: "dev.to, Hashnode, Medium…" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>
                  {f.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{f.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileMenu({
  anchorRef,
  onLogout,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onLogout: () => void;
}) {
  const rect = anchorRef.current?.getBoundingClientRect();
  return (
    <div
      role="menu"
      style={{
        position: "fixed",
        right: rect ? window.innerWidth - rect.right : 0,
        top: rect ? rect.bottom + 6 : 0,
        width: rect ? rect.width : "auto",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 50,
      }}
    >
      <button
        role="menuitem"
        onClick={onLogout}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        Sign out
      </button>
    </div>
  );
}

const BASE = "/inkwell/";

function slugFromUrl(): string | null {
  const path = window.location.pathname;
  if (path.startsWith(BASE)) {
    const rest = path.slice(BASE.length).replace(/\/$/, "");
    if (rest) return rest;
  }
  return null;
}

export default function StudioPage() {
  const [summaries, setSummaries] = useState<ArticleMeta[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(() => slugFromUrl() ?? "");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<"lint" | "publish" | "toc" | "chat">("publish");
  const [zenMode, setZenMode] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [appLoading, setAppLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  // Draft state for title/tags (decoupled from selectedArticle)
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Snapshot of last-saved/loaded state — isDirty is derived by comparison
  const savedSnapshot = useRef({ content: "", title: "", tags: "" });

  // Sync drafts and snapshot to a freshly loaded/saved article
  const syncToArticle = useCallback((article: Article | null) => {
    const title = article?.meta.title ?? "";
    const tags = article?.meta.tags ?? [];
    const content = article?.content ?? "";
    setDraftTitle(title);
    setDraftTags(tags);
    savedSnapshot.current = { content, title, tags: tags.join(",") };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      // 1. Auth check first — eliminates sign-in flash and auth/article race
      try {
        const user = await fetchCurrentUser();
        if (!ignore) setCurrentUser(user);
      } catch {
        // Not authenticated — leave null, demo mode continues
      }

      // 2. Load articles after auth settles
      try {
        const data = await fetchArticles();
        if (ignore) return;
        setSummaries(data);
        // Preserve the URL slug if it exists in the live list; otherwise fall back to first
        const urlSlug = slugFromUrl();
        const targetSlug =
          urlSlug && data.some((a) => a.slug === urlSlug) ? urlSlug : data[0]?.slug;
        if (targetSlug) {
          setSelectedSlug(targetSlug);
          setArticleLoading(true);
          try {
            const article = await fetchArticle(targetSlug);
            if (!ignore) {
              setSelectedArticle(article);
              syncToArticle(article);
            }
          } catch {
            if (!ignore) {
              setSelectedArticle(null);
              syncToArticle(null);
            }
          } finally {
            if (!ignore) setArticleLoading(false);
          }
        }
      } catch {
        // API unavailable — fall back to demo mock data
        if (!ignore) {
          setSummaries(MOCK_METAS);
          setSelectedSlug(MOCK_METAS[0].slug);
          setSelectedArticle(MOCK_ARTICLE);
          syncToArticle(MOCK_ARTICLE);
        }
      } finally {
        if (!ignore) setAppLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Keep URL in sync with selected article
  useEffect(() => {
    const url = selectedSlug ? `${BASE}${selectedSlug}` : BASE;
    if (window.location.pathname !== url) {
      window.history.pushState(null, "", url);
    }
  }, [selectedSlug]);

  // Derive isDirty by comparing current drafts + content against the saved snapshot
  const isDirty =
    (selectedArticle?.content ?? "") !== savedSnapshot.current.content ||
    draftTitle !== savedSnapshot.current.title ||
    draftTags.join(",") !== savedSnapshot.current.tags;

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ""; // required for Chrome
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleContentChange = (newContent: string) => {
    setSelectedArticle((prev) => (prev ? { ...prev, content: newContent } : prev));
  };

  const handleTitleChange = (title: string) => {
    setDraftTitle(title);
  };

  const handleTagsChange = (tags: string[]) => {
    setDraftTags(tags);
  };

  const handleNewArticle = () => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Leave without saving?");
      if (!ok) return;
    }
    setSelectedSlug("__new__");
    setSelectedArticle(EMPTY_ARTICLE);
    setDraftTitle("");
    setDraftTags([]);
    savedSnapshot.current = { content: "", title: "", tags: "" };
  };

  const handleSave = async () => {
    if (!selectedArticle || saving) return;
    if (!draftTitle.trim()) {
      // Empty title — do nothing (tests verify no API call is made)
      return;
    }
    const slug =
      selectedArticle.slug === "__new__" ? titleToSlug(draftTitle) : selectedArticle.slug;
    if (!slug) return; // empty slug from all-symbols title
    setSaving(true);
    setSaveError(false);
    try {
      let article: Article;
      if (selectedArticle.slug === "__new__") {
        article = await createArticle(draftTitle, slug, draftTags, selectedArticle.content);
        setSummaries((prev) => [...prev, article.meta]);
      } else {
        article = await saveArticle(selectedArticle.slug, {
          title: draftTitle,
          tags: draftTags,
          content: selectedArticle.content,
        });
        setSummaries((prev) => prev.map((m) => (m.slug === article.slug ? article.meta : m)));
      }
      setSelectedSlug(article.slug);
      setSelectedArticle(article);
      syncToArticle(article);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedArticle || selectedArticle.slug === "__new__" || deleting || saving) return;
    const confirmed = window.confirm(
      `Delete "${selectedArticle.meta.title || selectedArticle.slug}"? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteArticle(selectedArticle.slug);
      setSummaries((prev) => prev.filter((m) => m.slug !== selectedArticle.slug));
      const remaining = summaries.filter((m) => m.slug !== selectedArticle.slug);
      if (remaining.length > 0) {
        handleSelect(remaining[0].slug);
      } else {
        setSelectedSlug("__new__");
        setSelectedArticle(EMPTY_ARTICLE);
        syncToArticle(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSelect = (slug: string) => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Leave without saving?");
      if (!ok) return;
    }
    setSelectedSlug(slug);
    setArticleLoading(true);
    fetchArticle(slug)
      .then((article) => {
        setSelectedArticle(article);
        syncToArticle(article);
      })
      .catch(() => {
        const mock = MOCK_ARTICLE.slug === slug ? MOCK_ARTICLE : undefined;
        setSelectedArticle(mock ?? null);
        syncToArticle(mock ?? null);
      })
      .finally(() => setArticleLoading(false));
  };

  const toggleZen = useCallback(() => setZenMode((z) => !z), []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
    setCurrentUser(null);
    setProfileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleZen();
      }
      if (e.key === "z" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        toggleZen();
      }
      if (e.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleZen]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [profileMenuOpen]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Show landing page when signed out (and not in the initial loading phase)
  if (!appLoading && currentUser === null) {
    return (
      <SignedOutLanding
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-secondary)",
          transition: "max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease",
          maxHeight: zenMode ? "0" : "64px",
          overflow: "hidden",
          opacity: zenMode ? 0 : 1,
          paddingTop: zenMode ? "0" : undefined,
          paddingBottom: zenMode ? "0" : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <h1
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 500,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              color: "var(--text-primary)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>$</span>
            <span>inkwell</span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 14,
                marginLeft: 2,
                background: "var(--text-primary)",
                animation: "inkwell-blink 1.06s steps(1, end) infinite",
              }}
            />
          </h1>
          <span
            style={{
              fontSize: 9,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
            }}
          >
            write · commit · publish
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/linnienaryshkin/inkwell"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit Inkwell GitHub repository"
            aria-label="Visit Inkwell GitHub repository"
            className="inline-flex items-center justify-center p-1 transition-colors"
            style={{
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <FaGithub size={20} />
          </a>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="text-xs px-2 py-1 rounded border"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
          {appLoading ? (
            <div
              className="inline-flex items-center justify-center text-xs rounded"
              style={{
                height: "40px",
                width: "180px",
                color: "var(--text-secondary)",
              }}
            >
              Loading…
            </div>
          ) : currentUser === null ? (
            <a
              href={getLoginUrl()}
              aria-label="Sign in with GitHub"
              className="inline-flex items-center gap-1 px-2 rounded text-sm"
              style={{
                background: "var(--accent)",
                color: "var(--bg-primary)",
                height: "40px",
                width: "180px",
                justifyContent: "center",
              }}
            >
              <FaGithub size={16} />
              Sign in with GitHub
            </a>
          ) : (
            <div ref={profileMenuRef} style={{ position: "relative" }}>
              <button
                ref={profileButtonRef}
                onClick={() => setProfileMenuOpen((o) => !o)}
                aria-label="Open profile menu"
                aria-haspopup="true"
                aria-expanded={profileMenuOpen}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  transition: "opacity 0.2s ease",
                  width: "180px",
                  height: "40px",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.login}
                  className="w-8 h-8 rounded-full"
                />
                <span
                  style={{
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentUser.login}
                </span>
              </button>

              {profileMenuOpen && (
                <ProfileMenu anchorRef={profileButtonRef} onLogout={handleLogout} />
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Article list */}
        <div
          style={{
            transition: "max-width 0.3s ease, opacity 0.3s ease",
            maxWidth: zenMode ? "0" : "280px",
            opacity: zenMode ? 0 : 1,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <ArticleList
            articles={summaries}
            selectedSlug={selectedSlug}
            onSelect={handleSelect}
            onNewArticle={handleNewArticle}
          />
        </div>

        {/* Editor */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ position: "relative" }}>
          {articleLoading || !selectedArticle ? (
            <div
              data-testid="article-loading"
              className="flex-1 flex items-center justify-center"
              style={{ color: "var(--text-secondary)" }}
            >
              Loading…
            </div>
          ) : (
            <EditorPane
              key={selectedSlug}
              article={selectedArticle}
              draftTitle={draftTitle}
              draftTags={draftTags}
              onChange={handleContentChange}
              onTitleChange={handleTitleChange}
              onTagsChange={handleTagsChange}
              theme={theme}
              zenMode={zenMode}
              onToggleZen={toggleZen}
            />
          )}
          <VersionStrip
            slug={selectedSlug}
            versions={selectedArticle?.versions ?? []}
            isDirty={isDirty}
            saving={saving}
            deleting={deleting}
            saveError={saveError}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </div>

        {/* Side panel */}
        <div
          style={{
            transition: "max-width 0.3s ease, opacity 0.3s ease",
            maxWidth: zenMode ? "0" : "320px",
            opacity: zenMode ? 0 : 1,
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <SidePanel
            article={selectedArticle}
            activeTab={sidePanelTab}
            onTabChange={setSidePanelTab}
          />
        </div>
      </div>
    </div>
  );
}
