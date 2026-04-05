import { useState, useEffect, useCallback, useRef } from "react";
import { FaGithub } from "react-icons/fa";
import { ArticleList } from "@/components/ArticleList";
import { EditorPane } from "@/components/EditorPane";
import { SidePanel } from "@/components/SidePanel";
import { VersionStrip } from "@/components/VersionStrip";
import { fetchArticles, fetchArticle, fetchCurrentUser, getLoginUrl, logout } from "@/services/api";
import type { AuthUser } from "@/services/api";

export type ArticleVersion = {
  sha: string;
  message: string;
  committed_at: string;
};

export type Article = {
  slug: string;
  title: string;
  status: "draft" | "published";
  content: string;
  tags: string[];
  versions: ArticleVersion[];
};

export type ArticleSummary = {
  slug: string;
  title: string;
  status: "draft" | "published";
  tags: string[];
};

const MOCK_ARTICLES: Article[] = [
  {
    slug: "welcome",
    title: "Welcome to Inkwell",
    status: "draft",
    tags: [],
    versions: [],
    content: `# Welcome to Inkwell

Sign in with GitHub to unlock the full potential of the application.

Your articles are stored as files in your GitHub repository — version-controlled, diff-able, and always yours.
`,
  },
];

const MOCK_SUMMARIES: ArticleSummary[] = MOCK_ARTICLES.map(({ slug, title, status, tags }) => ({
  slug,
  title,
  status,
  tags,
}));

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

export default function StudioPage() {
  const [summaries, setSummaries] = useState<ArticleSummary[]>(MOCK_SUMMARIES);
  const [selectedSlug, setSelectedSlug] = useState(MOCK_SUMMARIES[0].slug);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(MOCK_ARTICLES[0]);
  const [articleLoading, setArticleLoading] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<"lint" | "publish" | "toc">("publish");
  const [zenMode, setZenMode] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [dataSource, setDataSource] = useState<"live" | "demo">("demo");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let ignore = false;
    fetchArticles()
      .then((data) => {
        if (ignore) return;
        setSummaries(data);
        setDataSource("live");
        const firstSlug = data[0]?.slug;
        if (firstSlug) {
          setSelectedSlug(firstSlug);
          setArticleLoading(true);
          fetchArticle(firstSlug)
            .then((article) => {
              if (ignore) return;
              setSelectedArticle(article);
            })
            .catch(() => {
              if (ignore) return;
              const mock = MOCK_ARTICLES.find((a) => a.slug === firstSlug);
              setSelectedArticle(mock ?? null);
            })
            .finally(() => {
              if (!ignore) setArticleLoading(false);
            });
        }
      })
      .catch(() => {
        // API unavailable — keep mock summaries and mock article
        if (!ignore) setSelectedArticle(MOCK_ARTICLES[0]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchCurrentUser()
      .then((user) => {
        if (ignore) return;
        setCurrentUser(user);
      })
      .catch(() => {
        // Not authenticated — leave null, demo mode continues
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleContentChange = (newContent: string) => {
    setSelectedArticle((prev) => (prev ? { ...prev, content: newContent } : prev));
  };

  const handleSelect = (slug: string) => {
    setSelectedSlug(slug);
    setArticleLoading(true);
    fetchArticle(slug)
      .then(setSelectedArticle)
      .catch(() => {
        const mock = MOCK_ARTICLES.find((a) => a.slug === slug);
        setSelectedArticle(mock ?? null);
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
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--accent)" }}>
            Inkwell
          </h1>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Personal Writing Studio
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: dataSource === "live" ? "var(--green)" : "var(--yellow)",
              color: "var(--bg-primary)",
              fontWeight: 500,
            }}
          >
            {dataSource === "live" ? "live" : "demo mode"}
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
          {currentUser === null ? (
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
          <ArticleList articles={summaries} selectedSlug={selectedSlug} onSelect={handleSelect} />
        </div>

        {/* Editor */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ position: "relative" }}>
          {articleLoading || !selectedArticle ? (
            <div
              className="flex-1 flex items-center justify-center"
              style={{ color: "var(--text-secondary)" }}
            >
              Loading…
            </div>
          ) : (
            <EditorPane
              key={selectedSlug}
              article={selectedArticle}
              onChange={handleContentChange}
              theme={theme}
              zenMode={zenMode}
              onToggleZen={toggleZen}
            />
          )}
          <VersionStrip slug={selectedSlug} />
        </div>

        {/* Side panel */}
        <div
          style={{
            transition: "max-width 0.3s ease, opacity 0.3s ease",
            maxWidth: zenMode ? "0" : "320px",
            opacity: zenMode ? 0 : 1,
            overflow: "hidden",
            flexShrink: 0,
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
