import { copyFileSync } from "node:fs";

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/lighthouse.ts", "src/bin/check-tokens.ts"],
  format: "esm",
  platform: "node",
  target: "node20",
  dts: true,
  clean: true,
  sourcemap: true,
  /* The optional peers must never be inlined — a consumer that installed none
     of them still has to be able to import the CSS side of this package. */
  deps: {
    neverBundle: ["@playwright/test", "playwright-lighthouse", "lighthouse"],
  },
  hooks: {
    "build:done": () => {
      // Beside dist/index.mjs, so `new URL("./tokens.css", import.meta.url)`
      // resolves in both the sources and the build.
      copyFileSync("src/tokens.css", "dist/tokens.css");
      // And again at the package root. postcss-import — which every Tailwind
      // v3 project runs — resolves with the classic CJS algorithm and ignores
      // `exports` entirely, so it looks for this literal path and nothing
      // else. Bundlers that do honour `exports` get the dist copy; both are
      // written from the same source in the same build.
      copyFileSync("src/tokens.css", "tokens.css");
    },
  },
});
