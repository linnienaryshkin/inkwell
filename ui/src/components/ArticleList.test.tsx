import { render, screen, fireEvent } from "@testing-library/react";
import { ArticleList } from "./ArticleList";
import type { ArticleMeta } from "@/app/studio/page";

describe("ArticleList", () => {
  const mockArticles: ArticleMeta[] = [
    {
      slug: "article-1",
      title: "Getting Started with TypeScript",
      status: "published",
      tags: ["typescript", "beginner"],
    },
    {
      slug: "article-2",
      title: "Advanced React Patterns",
      status: "draft",
      tags: ["react", "advanced"],
    },
  ];

  describe("Display", () => {
    it("should render all article titles", () => {
      render(<ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={() => {}} />);

      expect(screen.getByText("Getting Started with TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Advanced React Patterns")).toBeInTheDocument();
    });

    it("should display publication status for each article", () => {
      render(<ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={() => {}} />);

      expect(screen.getByText("published")).toBeInTheDocument();
      expect(screen.getByText("draft")).toBeInTheDocument();
    });

    it("should display article slugs", () => {
      render(<ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={() => {}} />);

      expect(screen.getByText("article-1")).toBeInTheDocument();
      expect(screen.getByText("article-2")).toBeInTheDocument();
    });

    it("should render the Articles header", () => {
      render(<ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={() => {}} />);

      expect(screen.getByText("Articles")).toBeInTheDocument();
    });

    it("should render the New Article button", () => {
      render(<ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={() => {}} />);

      expect(screen.getByText("+ New Article")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    it("should call onSelect when an article is clicked", () => {
      const handleSelect = jest.fn();
      render(
        <ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={handleSelect} />
      );

      const articleButton = screen.getByText("Advanced React Patterns").closest("button");
      fireEvent.click(articleButton!);

      expect(handleSelect).toHaveBeenCalledWith("article-2");
    });

    it("should highlight the selected article", () => {
      const { container } = render(
        <ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={() => {}} />
      );

      const buttons = container.querySelectorAll("button");
      const firstArticleButton = buttons[0];

      expect(firstArticleButton).toHaveStyle({
        borderLeft: "2px solid var(--accent)",
      });
    });

    it("should not highlight unselected articles", () => {
      const { container } = render(
        <ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={() => {}} />
      );

      const buttons = container.querySelectorAll("button");
      const secondArticleButton = buttons[1];

      const borderStyle = secondArticleButton.style.borderLeft;
      expect(borderStyle).toContain("transparent");
    });

    it("should allow switching between articles", () => {
      const handleSelect = jest.fn();
      render(
        <ArticleList articles={mockArticles} selectedSlug="article-1" onSelect={handleSelect} />
      );

      const article1Button = screen.getByText("Getting Started with TypeScript").closest("button");
      const article2Button = screen.getByText("Advanced React Patterns").closest("button");

      fireEvent.click(article1Button!);
      fireEvent.click(article2Button!);

      expect(handleSelect).toHaveBeenCalledTimes(2);
      expect(handleSelect).toHaveBeenLastCalledWith("article-2");
    });
  });

  describe("Empty state", () => {
    it("should render without articles", () => {
      render(<ArticleList articles={[]} selectedSlug="" onSelect={() => {}} />);

      expect(screen.getByText("Articles")).toBeInTheDocument();
      expect(screen.getByText("+ New Article")).toBeInTheDocument();
    });
  });
});
