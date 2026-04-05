// Custom Jest transform: replaces `import.meta.env` with a global
// `__importMetaEnv__` before ts-jest compiles the file.  This is required
// because ts-jest targets CommonJS and Node.js rejects `import.meta` syntax in
// CJS modules.  The `__importMetaEnv__` global is defined in jest.setup.env.ts.

const { TsJestTransformer } = require("ts-jest");

const transformer = new TsJestTransformer({
  tsconfig: {
    esModuleInterop: true,
  },
});

module.exports = {
  process(sourceText, sourcePath, options) {
    const patched = sourceText.replace(/import\.meta\.env/g, "__importMetaEnv__");
    return transformer.process(patched, sourcePath, options);
  },
  getCacheKey(fileData, filePath, options) {
    return transformer.getCacheKey(fileData, filePath, options);
  },
};
