#!/usr/bin/env node
/**
 * Asserts the contrast contract at the hues this project sets.
 *
 *   check-tokens src/styles/app.css
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { checkContract, describe, failures } from "../contract.ts";
import { readHues } from "../hues.ts";
import { malformedLightDark } from "../parse.ts";

/** Resolves against dist/bin/ when built, src/bin/ when type-stripped. */
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const { name, version } = JSON.parse(read("../../package.json")) as {
  name: string;
  version: string;
};

const args = process.argv.slice(2);
const quiet = args.includes("--quiet");
const paths = args.filter((arg) => !arg.startsWith("--"));

if (!paths.length) {
  console.error("usage: check-tokens <stylesheet.css> [...] [--quiet]");
  console.error(
    "  the stylesheet that sets --brand-hue / --accent-hue / --neutral-hue",
  );
  process.exit(2);
}

let sources: string[];
try {
  sources = paths.map((path) => readFileSync(path, "utf8"));
} catch (error) {
  console.error(`check-tokens: ${(error as Error).message}`);
  process.exit(2);
}

const tokens = read("../tokens.css");
const hues = readHues(sources);
const results = checkContract(tokens, hues);
const bad = failures(results);
const malformed = malformedLightDark(tokens);

const shown = Object.entries(hues)
  .map(([knob, value]) => `${knob} ${value}`)
  .join(" · ");

if (!quiet) {
  console.log(`${name}@${version}`);
  console.log(`hues: ${shown || "none set — using the token file's defaults"}`);
  console.log(
    `${results.length} pairs checked against WCAG 2 and APCA, ${bad.length} failing\n`,
  );
}

for (const result of bad) console.error(`  ✖ ${describe(result)}`);
for (const call of malformed) {
  console.error(`  ✖ light-dark() takes exactly two arguments: ${call}`);
}

if (bad.length || malformed.length) {
  console.error(
    `\ncheck-tokens: contract not met at these hues. Retune the hue, or the` +
      ` token, until it is — do not lower the floor.`,
  );
  process.exit(1);
}

if (!quiet) console.log("contract holds in both themes.");
