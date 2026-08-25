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
  external: ["@playwright/test", "playwright-lighthouse", "lighthouse"],
  hooks: {
    "build:done": () => {
      // Ships beside dist/index.js so `new URL("./tokens.css", import.meta.url)`
      // resolves in both the sources and the build.
      copyFileSync("src/tokens.css", "dist/tokens.css");
    },
  },
});
