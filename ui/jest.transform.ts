// Custom Jest transform that replaces `import.meta.env.X` references with
// `(typeof __VITE_ENV__ !== 'undefined' ? __VITE_ENV__?.X : undefined)` before
// ts-jest processes the file.  This is necessary because ts-jest compiles to
// CommonJS and cannot handle import.meta syntax at runtime.
//
// Strategy: replace `import.meta.env` with a global `__importMetaEnv__` object
// that we define in jest.setup.env.ts, so tests resolve VITE_* variables the
// same way the browser would.

import { createTransformer } from "ts-jest";

const tsjTransformer = createTransformer({
  tsconfig: {
    esModuleInterop: true,
  },
});

const process = tsjTransformer.process!;

export default {
  ...tsjTransformer,
  process(sourceText: string, sourcePath: string, options: object) {
    const patched = sourceText.replace(
      /import\.meta\.env/g,
      "__importMetaEnv__"
    );
    return (process as Function).call(this, patched, sourcePath, options);
  },
};
