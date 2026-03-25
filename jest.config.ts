import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "/node_modules/(?!(react-markdown|remark-gfm|github-markdown-css|@types/github-markdown-css|micromark|decode-named-character-reference|character-entities|unist-|mdast-util-|ccount|escape-string-regexp|markdown-table|space-separated-tokens|comma-separated-tokens|web-namespaces|vfile|bail|trough|is-buffer|is-plain-obj|is-reference|react-icons)/)",
  ],

  // ── Coverage ────────────────────────────────────────────────────────────────
  collectCoverageFrom: [
    "src/**/*.tsx", // all TSX files under src
    "!src/**/*.test.tsx", // exclude test files themselves
    "!src/**/*.spec.tsx", // exclude spec files
    "!src/**/__tests__/**", // exclude __tests__ directories
    "!src/**/index.tsx", // exclude barrel files
    "!src/app/**", // exclude Next.js app directory (layout, redirects, etc)
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    // optional: enforce minimums, adjust as needed
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

export default createJestConfig(config);
