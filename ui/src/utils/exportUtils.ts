import type { Article } from "@/app/studio/page";

export type PdfOptions = {
  fontSize: number;
  colorScheme: "light" | "dark";
};

/**
 * Export article content as a Markdown file (.md)
 */
export function exportToMarkdown(article: Article): void {
  const blob = new Blob([article.content], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${article.meta.title || article.slug}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export article as PDF with Mermaid diagrams rendered
 */
export async function exportToPdf(article: Article, options: PdfOptions): Promise<void> {
  // Lazy-load html2pdf to reduce bundle size
  const html2pdf = (await import("html2pdf.js")).default;

  // Extract and render all mermaid diagrams
  const mermaidFences = extractMermaidFences(article.content);
  const mermaidSvgs: Record<number, string> = {};

  for (let i = 0; i < mermaidFences.length; i++) {
    try {
      const mermaidWindow = window as unknown as {
        mermaid: { render: (id: string, code: string) => Promise<{ svg: string }> };
      };
      const { svg } = await mermaidWindow.mermaid.render(`mermaid-export-${i}`, mermaidFences[i]);
      mermaidSvgs[i] = svg;
    } catch (error) {
      console.error(`Failed to render mermaid diagram ${i}:`, error);
      // Continue with other diagrams
    }
  }

  // Build HTML content with rendered diagrams
  const htmlContent = buildHtmlContent(article.content, mermaidFences, mermaidSvgs, options);

  // Create hidden container
  const container = document.createElement("div");
  container.innerHTML = htmlContent;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = "1200px";
  container.style.padding = "40px";
  container.style.fontSize = `${options.fontSize}px`;
  container.style.fontFamily = "system-ui, -apple-system, sans-serif";
  container.style.lineHeight = "1.6";

  // Apply color scheme
  if (options.colorScheme === "light") {
    container.style.backgroundColor = "#ffffff";
    container.style.color = "#1a1a1a";
  } else {
    container.style.backgroundColor = "#1e1e1e";
    container.style.color = "#e0e0e0";
  }

  document.body.appendChild(container);

  // Wait a moment for DOM to be ready
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Generate PDF
  const filename = `${article.meta.title || article.slug}.pdf`;
  html2pdf()
    .set({
      margin: 10,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(container)
    .save();

  // Cleanup
  document.body.removeChild(container);
}

/**
 * Extract all mermaid code fences from markdown content
 */
function extractMermaidFences(content: string): string[] {
  const regex = /```mermaid\n([\s\S]*?)\n```/g;
  const matches = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Convert markdown to HTML and embed mermaid SVGs
 */
function buildHtmlContent(
  markdown: string,
  mermaidFences: string[],
  mermaidSvgs: Record<number, string>,
  options: PdfOptions
): string {
  let html = escapeHtml(markdown);

  // Basic markdown conversion (heading, bold, italic, lists)
  html = html
    .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/gm, "<p>")
    .replace(/$/gm, "</p>");

  // Replace mermaid placeholders with SVGs
  for (let i = 0; i < mermaidFences.length; i++) {
    const svg = mermaidSvgs[i];
    if (svg) {
      const borderColor = options.colorScheme === "light" ? "#ddd" : "#444";
      const svgHtml = `<div style="margin: 20px 0; padding: 10px; border: 1px solid ${borderColor}; border-radius: 4px;">${svg}</div>`;
      html = html.replace(/```mermaid\n[\s\S]*?\n```/, svgHtml);
    }
  }

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
