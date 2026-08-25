# @asmyshlyaev177/design-tokens

OKLCH design tokens for [asmyshlyaev177.dev](https://asmyshlyaev177.dev/design)
and its sibling project sites. One CSS file, both themes, and a WCAG contrast
contract that is checked rather than asserted in prose.

```sh
pnpm add -D @asmyshlyaev177/design-tokens
```

```css
@import "@asmyshlyaev177/design-tokens/tokens.css";

:root {
  --brand-hue: 264;
  --accent-hue: 60;
  --neutral-hue: 264;
}
```

That is the whole integration. Every token is a CSS custom property, so it
works in any framework, and both theme ramps live in one `light-dark()`
declaration per token — there is no second block to keep in step.

## The two axes a project changes

Everything in `tokens.css` is identical everywhere except:

1. **`--brand-hue` / `--accent-hue` / `--neutral-hue`** — OKLCH hue angles, set
   in your own `:root` after the import.
2. **`--font-sans` / `--font-display` / `--font-mono`** — deliberately _not_
   defined by this package. Tailwind puts `@theme` variables in `@layer theme`,
   and an unlayered rule beats a layered one at any order, so a fallback here
   would silently outrank the families your project actually self-hosts.

## Checking the contract

```sh
npx check-tokens src/styles/app.css
```

Point it at whichever stylesheet sets your hue knobs. It reads them, resolves
every token at those angles, and measures the pairs that have to clear WCAG AA:

```
@asmyshlyaev177/design-tokens@1.0.0
hues: brand 183 · accent 183 · neutral 284
26 pairs checked, 0 failing

contract holds in both themes.
```

Exit code 1 on any failure, so it drops straight into a test script.

The check runs in _your_ repo rather than centrally, because the hue knobs are
the one thing each project changes — a contract that hardcoded the known hues
would vouch for a configuration a project might no longer have.

### What is measured

| Token               | Against                            | Floor |
| ------------------- | ---------------------------------- | ----- |
| `--ink`             | `--bg`, `--surface`, `--surface-2` | 4.5:1 |
| `--muted`           | `--bg`, `--surface`, `--surface-2` | 4.5:1 |
| `--faint`           | `--bg`, `--surface`, `--surface-2` | 3:1   |
| `--link`            | `--bg`                             | 4.5:1 |
| `--primary-on-soft` | `--primary-soft`                   | 4.5:1 |
| `--accent-on-soft`  | `--accent-soft`                    | 4.5:1 |
| `--on-primary`      | `--primary`                        | 4.5:1 |

In both themes, so 26 assertions. `--surface-2` is in the list because it is
the lightest ground a token can legitimately sit on; measuring against `--bg`
alone flatters everything, which is how a `--ink/55` alpha tint once shipped as
body text at 3.99:1.

The ramp fixes lightness and chroma per token and varies only hue, so the
guarantee is hue-independent: the suite asserts it at all 72 five-degree steps
around the wheel, not only at the angles in use. Pick any hue.

## Three rules the ramp encodes

Each was a real bug before it was a token.

- **`--muted`, not an alpha tint.** Secondary text has a token whose contract
  is checked; a tint's is not. `/50` and `/55` measure 3.43:1 and 3.99:1.
- **`--link` is not `--primary`.** `--primary` is a _fill_, held dark enough
  that `--on-primary` clears AA on top of it. At cyan there is no lightness
  that is both that and readable as a link on a dark ground, so they are two
  tokens.
- **The opt-in selectors are `:root`-scoped.** Unscoped, `[data-theme="light"]`
  matches any element using the attribute for its own purposes — a theme menu
  labelling its buttons `data-theme="light|dark|system"` rendered each one in
  that theme.

## Themes

A document that sets neither class follows the reader's OS through
`color-scheme: light dark`. Both spellings of an explicit choice are honoured:

```html
<html class="dark">
  <!-- or class="light" -->
  <html data-theme="dark">
    <!-- or data-theme="light" -->
  </html>
</html>
```

An explicit _light_ choice needs the class. Removing `.dark` now means "ask the
OS", not "be light".

## Lighthouse helper

Optional. `@playwright/test`, `lighthouse` and `playwright-lighthouse` are
optional peer dependencies, imported lazily — a project that wants only the CSS
never installs Chromium tooling.

```ts
import {
  auditPage,
  CATEGORIES,
  failedAudits,
} from "@asmyshlyaev177/design-tokens/lighthouse";

test("homepage meets Lighthouse thresholds", async () => {
  const { lhr } = await auditPage({
    url: `${PREVIEW_URL}/`,
    thresholds: {
      performance: 100,
      accessibility: 100,
      "best-practices": 100,
      seo: 100,
    },
    categories: CATEGORIES,
  });
});
```

It handles the CDP port arithmetic, the desktop config and the browser
lifecycle; which pages you audit and what you hold them to stays yours.

Pass `categories` when a page is held to fewer categories than it should run —
`playwright-lighthouse` otherwise derives `onlyCategories` from the threshold
keys, so an unheld category never executes and its audits cannot be inspected.
`failedAudits(lhr, "seo")` is there for exactly that case: a `noindex` page is
_meant_ to fail `is-crawlable` and nothing else.

## Node API

```js
import {
  checkContract,
  failures,
  describe,
  tokensCss,
} from "@asmyshlyaev177/design-tokens";

const bad = failures(
  checkContract(tokensCss, { brand: 183, accent: 183, neutral: 284 }),
);
bad.forEach((r) => console.error(describe(r)));
```

Also exported: `parseTokens`, `resolve`, `pickTheme`, `malformedLightDark`,
`readHues`, and the colour maths (`contrast`, `flatten`, `oklchToRgb`,
`rgbToOklch`, `parseOklch`, `toHex`, `AA_NORMAL`, `AA_LARGE`).

`parseTokens` is what renders the live table at
[asmyshlyaev177.dev/design](https://asmyshlyaev177.dev/design) — the page reads
this file, so it cannot claim a colour the package does not ship.

## Working on it

TypeScript sources in `src/`, built with [tsdown](https://tsdown.dev) to ESM
plus declarations in `dist/`. `tokens.css` lives in `src/` and is copied beside
`dist/index.mjs`, so `new URL("./tokens.css", import.meta.url)` resolves the
same in the sources and in the build.

```sh
pnpm test        # runs the .ts sources directly — node strips the types
pnpm typecheck   # tsc --noEmit over src and test
pnpm check       # the shipped tokens against their own defaults
pnpm build
```

There is no build step between editing a source file and running the suite.

## Releasing

Conventional commits, [release-please](https://github.com/googleapis/release-please)
opens the release PR, merging it publishes to npm with provenance.

**A token rename or removal is a breaking change for every consuming
stylesheet.** Mark it `feat!:` or add a `BREAKING CHANGE:` footer. Adding a
token is a `feat:`; retuning an existing value without changing its name is a
`fix:` when it repairs a contrast failure and `tokens:` otherwise.

## Consumers

[asmyshlyaev177.dev](https://asmyshlyaev177.dev) · [state-in-url](https://state-in-url.dev) ·
[test-proxy-recorder](https://github.com/asmyshlyaev177/test-proxy-recorder) ·
[react-horizontal-scrolling-menu](https://react-horizontal-scrolling-menu.dev) ·
[x-profile-location](https://github.com/asmyshlyaev177/x-profile-location)

MIT
