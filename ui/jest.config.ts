import type { Config } from "jest";

const config: Config = {
  coverageProvider: "v8",
  setupFiles: ["<rootDir>/jest.setup.env.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": "<rootDir>/jest.transform.cjs",
  },
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "/node_modules/(?!(react-markdown|remark-gfm|github-markdown-css|@types/github-markdown-css|micromark|decode-named-character-reference|character-entities|unist-|mdast-util-|ccount|escape-string-regexp|markdown-table|space-separated-tokens|comma-separated-tokens|web-namespaces|vfile|bail|trough|is-buffer|is-plain-obj|is-reference|react-icons|mermaid)/)",
  ],

  // ── Coverage ────────────────────────────────────────────────────────────────
  collectCoverageFrom: [
    "src/**/*.tsx", // all TSX files under src
    "!src/**/*.test.tsx", // exclude test files themselves
    "!src/**/*.spec.tsx", // exclude spec files
    "!src/**/__tests__/**", // exclude __tests__ directories
    "!src/**/index.tsx", // exclude barrel files
    "!src/main.tsx", // exclude Vite entry point
    "!src/app/studio/page.tsx", // exclude top-level page (covered via integration)
    "!src/components/MarkdownComponents.tsx", // exclude config exports (covered via integration)
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

export default config;
