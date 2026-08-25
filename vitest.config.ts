import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // src/contrast.ts is browser code executed by Playwright, not here.
    environment: "node",
  },
});
