import mermaid from "mermaid";
import DOMPurify from "dompurify";
import type { Article } from "@/app/studio/page";

export type PdfOptions = {
  fontSize: number;
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
  try {
    // Initialize mermaid with strict security level and light theme for PDF
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });

    // Render mermaid diagrams first
    const mermaidFences = extractMermaidFences(article.content);
    const mermaidSvgs: Record<number, string> = {};

    for (let i = 0; i < mermaidFences.length; i++) {
      try {
        const result = await mermaid.render(`mermaid-export-${i}`, mermaidFences[i]);
        // Sanitize SVG with DOMPurify
        mermaidSvgs[i] = DOMPurify.sanitize(result.svg, {
          ALLOWED_TAGS: [
            "svg",
            "g",
            "path",
            "text",
            "rect",
            "circle",
            "line",
            "polygon",
            "use",
            "tspan",
            "defs",
            "style",
            "marker",
            "linearGradient",
            "stop",
          ],
        });
      } catch (error) {
        console.error(`Failed to render mermaid diagram ${i}:`, error);
      }
    }

    // Create a hidden iframe for printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || (iframe.contentWindow?.document as Document);
    if (!iframeDoc) {
      throw new Error("Failed to access iframe document");
    }

    // Build HTML content
    const htmlContent = buildPdfHtml(article.content, mermaidSvgs, options);

    // Write to iframe
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for the document to be ready, then trigger print
    await new Promise((resolve) => {
      if (iframe.contentWindow?.document.readyState === "complete") {
        resolve(null);
      } else {
        iframe.onload = () => {
          resolve(null);
        };
      }
    });

    // Give the browser a moment to render the SVGs
    await new Promise((resolve) => setTimeout(resolve, 500));

    iframe.contentWindow?.print();

    // Cleanup after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  } catch (error) {
    console.error("PDF export error:", error);
    throw error;
  }
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
 * Build PDF HTML with rich markdown formatting (tables, lists, etc.)
 */
function buildPdfHtml(
  markdown: string,
  mermaidSvgs: Record<number, string>,
  options: PdfOptions
): string {
  // Replace mermaid code blocks with markers first
  let content = markdown;

  // Replace ALL mermaid blocks with markers using global regex
  let mermaidIndex = 0;
  content = content.replace(/```mermaid\n[\s\S]*?\n```/g, () => {
    return `__MERMAID_${mermaidIndex++}__`;
  });

  // Convert markdown to HTML while preserving structure
  let html = convertMarkdownToHtml(content);

  // Replace mermaid markers with SVGs
  Object.entries(mermaidSvgs).forEach(([index, svg]) => {
    const marker = `__MERMAID_${index}__`;
    html = html.split(marker).join(svg);
  });

  // Use light color scheme for PDF (standard for printing)
  const textColor = "#24292e";
  const bgColor = "#fff";
  const borderColor = "#eaecef";
  const codeBlockBg = "#f6f8fa";
  const codeBg = "rgba(27,31,35,0.05)";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: ${options.fontSize}px;
      line-height: 1.6;
      color: ${textColor};
      background: ${bgColor};
      padding: 2cm;
    }
    h1 {
      font-size: 2em;
      font-weight: 600;
      margin: 24px 0 16px 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid ${borderColor};
    }
    h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin: 24px 0 16px 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid ${borderColor};
    }
    h3 {
      font-size: 1.25em;
      font-weight: 600;
      margin: 24px 0 16px 0;
    }
    p {
      margin: 16px 0;
      word-wrap: break-word;
    }
    strong {
      font-weight: 600;
    }
    em {
      font-style: italic;
    }
    code {
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background-color: ${codeBg};
      border-radius: 3px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    pre {
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: ${codeBlockBg};
      border-radius: 6px;
      margin: 16px 0;
      word-wrap: break-word;
    }
    pre code {
      display: inline;
      padding: 0;
      margin: 0;
      overflow: visible;
      line-height: inherit;
      background-color: transparent;
      border-radius: 0;
    }
    ul, ol {
      padding-left: 2em;
      margin: 16px 0;
    }
    li {
      margin-bottom: 8px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    table tr {
      background-color: ${bgColor};
      border-top-color: ${borderColor};
    }
    table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    table th,
    table td {
      padding: 6px 13px;
      border: 1px solid ${borderColor};
      text-align: left;
    }
    table th {
      font-weight: 600;
      background-color: #f6f8fa;
    }
    svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 24px 0;
      page-break-inside: avoid;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
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

/**
 * Convert markdown to HTML, handling headings, bold, italic, code, tables, lists, etc.
 */
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Protect mermaid markers from markdown processing
  const mermaidMarkers: Record<string, string> = {};
  let markerIndex = 0;
  html = html.replace(/__MERMAID_\d+__/g, (match) => {
    const placeholder = `MERMAIDPLACEHOLDER${markerIndex}MERMAIDPLACEHOLDER`;
    mermaidMarkers[placeholder] = match;
    markerIndex++;
    return placeholder;
  });

  // Process headings first
  html = html
    .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // Process text formatting
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>");

  // Process inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Process code blocks
  html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");

  // Process tables (GitHub flavored markdown style)
  html = processTableMarkdown(html);

  // Process lists
  html = processListMarkdown(html);

  // Process line breaks and paragraphs
  html = processParagraphs(html);

  // Restore mermaid markers
  Object.entries(mermaidMarkers).forEach(([placeholder, original]) => {
    html = html.split(placeholder).join(original);
  });

  return html;
}

/**
 * Convert markdown tables to HTML tables
 */
function processTableMarkdown(html: string): string {
  // Match table pattern: rows separated by newlines, cells separated by pipes
  const tableRegex = /\|(.+)\n\|[-\s|:]+\n((?:\|.+\n?)*)/gm;

  return html.replace(tableRegex, (match) => {
    const lines = match.trim().split("\n");
    if (lines.length < 2) return match;

    const headerCells = lines[0]
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell);
    const bodyLines = lines.slice(2);

    let table = "<table><thead><tr>";
    headerCells.forEach((cell) => {
      table += `<th>${escapeHtml(cell)}</th>`;
    });
    table += "</tr></thead><tbody>";

    bodyLines.forEach((line) => {
      if (line.trim()) {
        const cells = line
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell);
        table += "<tr>";
        cells.forEach((cell) => {
          table += `<td>${escapeHtml(cell)}</td>`;
        });
        table += "</tr>";
      }
    });

    table += "</tbody></table>";
    return table;
  });
}

/**
 * Convert markdown lists to HTML lists
 */
function processListMarkdown(html: string): string {
  // Process unordered lists (lines starting with - or *)
  html = html.replace(/((?:^[\s]*[-*] .+$\n?)+)/gm, (match) => {
    const items = match
      .split("\n")
      .filter((line) => line.trim().match(/^[-*] /))
      .map((line) => `<li>${escapeHtml(line.replace(/^[-*] /, ""))}</li>`);
    return items.length ? `<ul>${items.join("")}</ul>` : match;
  });

  // Process ordered lists (lines starting with numbers)
  html = html.replace(/((?:^[\s]*\d+\. .+$\n?)+)/gm, (match) => {
    const items = match
      .split("\n")
      .filter((line) => line.trim().match(/^\d+\. /))
      .map((line) => `<li>${escapeHtml(line.replace(/^\d+\. /, ""))}</li>`);
    return items.length ? `<ol>${items.join("")}</ol>` : match;
  });

  return html;
}

/**
 * Process paragraphs - wrap non-HTML text in <p> tags
 */
function processParagraphs(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inBlock = false;
  let currentPara = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if line is a block element or a mermaid marker
    if (
      trimmed.match(/^<(h[1-3]|div|pre|ul|ol|table|blockquote)/) ||
      trimmed.match(/^__MERMAID_\d+__$/)
    ) {
      if (currentPara) {
        result.push(`<p>${escapeHtml(currentPara)}</p>`);
        currentPara = "";
      }
      result.push(line);
      inBlock = true;
    } else if (trimmed === "") {
      if (currentPara) {
        result.push(`<p>${escapeHtml(currentPara)}</p>`);
        currentPara = "";
      }
      inBlock = false;
    } else if (!inBlock) {
      if (currentPara) {
        currentPara += " " + trimmed;
      } else {
        currentPara = trimmed;
      }
    }
  }

  if (currentPara) {
    result.push(`<p>${escapeHtml(currentPara)}</p>`);
  }

  return result.join("\n");
}
