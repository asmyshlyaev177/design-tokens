export * from "./color.ts";
export * from "./parse.ts";
export * from "./contract.ts";
export * from "./apca.ts";
export * from "./hues.ts";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The token file this package ships. Resolves in both src/ and dist/. */
export const tokensCss: string = readFileSync(
  fileURLToPath(new URL("./tokens.css", import.meta.url)),
  "utf8",
);
