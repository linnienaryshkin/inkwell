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
export async function exportToPdf(article: Article, _options: PdfOptions): Promise<void> {
  try {
    // Render mermaid diagrams first
    const mermaidFences = extractMermaidFences(article.content);
    const mermaidSvgs: Record<number, string> = {};

    for (let i = 0; i < mermaidFences.length; i++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mermaidWindow = window as any;
        const { svg } = await mermaidWindow.mermaid.render(`mermaid-export-${i}`, mermaidFences[i]);
        mermaidSvgs[i] = svg;
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

    // Build HTML content
    const htmlContent = buildPdfHtml(article.content, mermaidSvgs);

    // Write to iframe
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for content to render, then trigger print
    iframe.onload = () => {
      iframe.contentWindow?.print();
    };

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
function buildPdfHtml(markdown: string, mermaidSvgs: Record<number, string>): string {
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
    // Replace in paragraph tags first, then any remaining markers
    html = html
      .replace(new RegExp(`<p>${marker}</p>`, "g"), `<div class="mermaid-diagram">${svg}</div>`)
      .replace(new RegExp(`${marker}`, "g"), `<div class="mermaid-diagram">${svg}</div>`);
  });

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
      font-size: 14px;
      line-height: 1.6;
      color: #24292e;
      background: #fff;
      padding: 2cm;
    }
    h1 {
      font-size: 2em;
      font-weight: 600;
      margin: 24px 0 16px 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #eaecef;
    }
    h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin: 24px 0 16px 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #eaecef;
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
      background-color: rgba(27,31,35,0.05);
      border-radius: 3px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    pre {
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: #f6f8fa;
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
      background-color: #fff;
      border-top-color: #dfe2e5;
    }
    table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    table th,
    table td {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
      text-align: left;
    }
    table th {
      font-weight: 600;
      background-color: #f6f8fa;
    }
    .mermaid-diagram {
      margin: 20px 0;
      padding: 10px;
      border: 1px solid #ddd;
      text-align: center;
      page-break-inside: avoid;
    }
    .mermaid-diagram svg {
      max-width: 100%;
      height: auto;
      display: inline-block;
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
 * Convert markdown to HTML, handling headings, bold, italic, code, tables, lists, etc.
 */
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;

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
      table += `<th>${cell}</th>`;
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
          table += `<td>${cell}</td>`;
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
      .map((line) => `<li>${line.replace(/^[-*] /, "")}</li>`);
    return items.length ? `<ul>${items.join("")}</ul>` : match;
  });

  // Process ordered lists (lines starting with numbers)
  html = html.replace(/((?:^[\s]*\d+\. .+$\n?)+)/gm, (match) => {
    const items = match
      .split("\n")
      .filter((line) => line.trim().match(/^\d+\. /))
      .map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`);
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

    // Check if line is a block element
    if (trimmed.match(/^<(h[1-3]|div|pre|ul|ol|table|blockquote)/)) {
      if (currentPara) {
        result.push(`<p>${currentPara}</p>`);
        currentPara = "";
      }
      result.push(line);
      inBlock = true;
    } else if (trimmed === "") {
      if (currentPara) {
        result.push(`<p>${currentPara}</p>`);
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
    result.push(`<p>${currentPara}</p>`);
  }

  return result.join("\n");
}
