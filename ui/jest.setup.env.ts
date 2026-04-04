// Define __importMetaEnv__ so that jest.transform.ts replacements resolve
// correctly.  VITE_API_BASE is undefined so api.ts falls back to
// "http://localhost:8000", which matches existing test expectations.
(globalThis as Record<string, unknown>)["__importMetaEnv__"] = {
  VITE_API_BASE: undefined,
};
