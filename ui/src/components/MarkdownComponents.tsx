import React from "react";
import type { Components } from "react-markdown";

export const markdownComponents: Components = {
  p: ({ children }) => <div>{children}</div>,
  strong: ({ children }) => <strong>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  code: ({ children }) => (
    <code
      style={{
        backgroundColor: "rgba(0,0,0,0.1)",
        padding: "2px 4px",
        borderRadius: "2px",
        fontFamily: "monospace",
        fontSize: "0.8em",
      }}
    >
      {children}
    </code>
  ),
};
