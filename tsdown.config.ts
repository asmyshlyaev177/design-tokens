import { copyFileSync } from "node:fs";

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/contrast.ts",
    "src/lighthouse.ts",
    "src/bin/check-tokens.ts",
  ],
  tsconfig: "./tsconfig.build.json",
  format: "esm",
  platform: "node",
  target: "node20",
  dts: true,
  clean: true,
  sourcemap: true,
  /* Never inline the optional peers: a CSS-only consumer installs none of them. */
  deps: {
    neverBundle: ["@playwright/test", "playwright-lighthouse", "lighthouse"],
  },
  hooks: {
    "build:done": () => {
      // Beside dist/index.mjs for the runtime read, and again at the package
      // root for postcss-import, which ignores `exports`. See CLAUDE.md.
      copyFileSync("src/tokens.css", "dist/tokens.css");
      copyFileSync("src/tokens.css", "tokens.css");
    },
  },
});
