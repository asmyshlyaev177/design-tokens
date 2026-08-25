export * from "./color.ts";
export * from "./parse.ts";
export * from "./contract.ts";
export * from "./hues.ts";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The token file this package ships, as text.
 *
 * `./tokens.css` resolves next to this module in both source and dist, which
 * is why the stylesheet lives in `src/` rather than at the repository root.
 */
export const tokensCss: string = readFileSync(
  fileURLToPath(new URL("./tokens.css", import.meta.url)),
  "utf8",
);
