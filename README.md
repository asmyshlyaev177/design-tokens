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

| Token               | Against                              | Floor |
| ------------------- | ------------------------------------ | ----- |
| `--ink`             | `--bg`, `--surface`, `--surface-2`   | 4.5:1 |
| `--muted`           | `--bg`, `--surface`, `--surface-2`   | 4.5:1 |
| `--faint`           | `--bg`, `--surface`, `--surface-2`   | 3:1   |
| `--link`            | `--bg`                               | 4.5:1 |
| `--primary-on-soft` | `--primary-soft` + all three grounds | 4.5:1 |
| `--accent-on-soft`  | `--accent-soft` + all three grounds  | 4.5:1 |
| `--on-primary`      | `--primary`                          | 4.5:1 |

Each pair is held to **both** WCAG 2 and APCA, in both themes — 38 assertions.
`--surface-2` is in the list because it is
the lightest ground a token can legitimately sit on; measuring against `--bg`
alone flatters everything, which is how a `--ink/55` alpha tint once shipped as
body text at 3.99:1.

The `*-on-soft` tokens are measured on the grounds as well as on their own tint
because they are the only brand-coloured _text_ tokens — a coloured label on a
plain surface has nothing else to reach for. `--primary` and `--accent` are
fills, held dark enough that `--on-primary` clears AA on top of them, and a
page that reaches for one as small text is relying on the ground being nearly
white.

The ramp fixes lightness and chroma per token and varies only hue, so the
guarantee is hue-independent: the suite asserts it at all 72 five-degree steps
around the wheel, not only at the angles in use. Pick any hue.

### Why two contrast models

WCAG 2's ratio is one formula applied to both polarities, and it flatters light
text on a dark ground. This system shipped a dark `--muted` at 6.0:1 — past AA
without argument — that [APCA](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)
rates **Lc 42**: under half of body level, and below even its non-text tier.
Nothing in the suite could see it, because nothing was asking the second
question.

**APCA is not a standard, and this package does not claim it is.** It is an
independent algorithm proposed as a candidate for WCAG 3. The
[WCAG 3 working draft](https://github.com/w3c/wcag3) does not adopt it and does
not mention it anywhere in the repository; its contrast requirement is still
the literal placeholder `@@[contrast measure to be determined]`, with an
editor's note that "the contrast algorithm used in WCAG 3 is yet to be
determined". WCAG 2.x AA is the normative gate here. APCA is the second
opinion, and it is the one that catches dark-theme regressions.

The Lc floors are this package's own, calibrated against what shipping design
systems reach rather than against APCA's tiers:

|                 | dark secondary text | dark link |
| --------------- | ------------------- | --------- |
| GitHub Primer   | Lc 44               | Lc 44     |
| Tailwind        | Lc 52               | —         |
| IBM Carbon      | Lc 71               | Lc 55     |
| Material 3      | Lc 72               | Lc 72     |
| **this system** | **Lc 72**           | **Lc 71** |

APCA's own guidance is Lc 75 minimum for body text, but that is unreachable for
_coloured_ text on a dark ground: at this ramp's chroma it needs L 0.975, which
is no longer a brand colour but a near-white tint of one. The floors used are
70 for secondary text, 60 for coloured text and 45 for the icon/large-text
tier — the top of the field rather than the top of the scale.

APCA is reimplemented in `src/apca.ts` so that installing the CSS pulls in
nothing; `test/apca.test.ts` pins it against the official `apca-w3` package,
which is a devDependency.

## Three rules the ramp encodes

Each was a real bug before it was a token.

- **`--muted`, not an alpha tint.** Secondary text has a token whose contract
  is checked; a tint's is not. `/50` and `/55` measure 3.43:1 and 3.99:1.
- **`--link` is not `--primary`.** `--primary` is a _fill_, held dark enough
  that `--on-primary` clears AA on top of it. At cyan there is no lightness
  that is both that and readable as a link on a dark ground, so they are two
  tokens. `--accent-on-soft` is the same split for the accent.
- **The light ground is not white.** `--bg` sits at L 0.972 — paper, not a
  lightbox. The softening is in the _ground_, not in the text: `--ink` holds
  body copy at ~16:1, and `--muted` and `--faint` were re-solved against the
  new ground rather than left to drift under it. Dropping the ground without
  moving the text is what turns a softer page into a harder-to-read one.
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

## Rendered-contrast helper

Lighthouse audits light mode only, scores no element without a text node, and
never opens a modal. `check-tokens` proves the ramp is sound; this proves the
pages use it.

```ts
import {
  auditContrast,
  contrastFailures,
  describeContrast,
} from "@asmyshlyaev177/design-tokens/contrast";

test.use({ colorScheme: "dark" });

test("/blog clears both floors", async ({ page }) => {
  await page.goto("/blog");
  const { findings, unresolved } = await auditContrast(page, {
    ignore: ["pre.astro-code"],
  });

  expect(findings.length).toBeGreaterThan(20);
  expect(unresolved).toBeLessThan(findings.length);
  expect(contrastFailures(findings).map(describeContrast)).toEqual([]);
});
```

Every visible text node is scored on both models. `unresolved` counts nodes
skipped because an image or gradient sat under the text — assert on it, or a
gradient on `<body>` leaves the suite silently green.

The floors are the weakest the contract grants any token at that size, so a
finding means the page reached for the wrong token, not that the ramp is off.
Pass `tiers` to hold a project to more.

`root` scopes the walk to a modal or region; `ignore` drops subtrees whose
palette is not yours, such as a vendored syntax-highlighting theme.

## Accessibility helper

The rules a contrast audit does not cover, from axe-core. Lighthouse bundles axe
too, but runs 66 of its 104 rules, in one theme, and scores a weighted average
rather than pass/fail — `region`, `nested-interactive`, `duplicate-id-active`,
`scrollable-region-focusable` and the whole `landmark-*` family never run there.

```ts
import {
  auditA11y,
  describeViolation,
} from "@asmyshlyaev177/design-tokens/axe";

test("/blog has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/blog");
  const { violations, incomplete, passes } = await auditA11y(page, {
    tags: COMPREHENSIVE_TAGS,
    exclude: ["iframe.giscus-frame"],
  });

  expect(passes).toBeGreaterThan(10);
  expect(violations.map(describeViolation)).toEqual([]);
  expect(incomplete.map((r) => r.id)).toEqual(REVIEWED);
});
```

Requires `@axe-core/playwright`, an optional peer — it is imported lazily, so a
CSS-only consumer installs none of it.

**axe's own `color-contrast` and `color-contrast-enhanced` are disabled by
default.** `auditContrast` scores the same nodes against APCA as well as WCAG 2,
walks both themes and settles animations first; running both duplicates every
finding and contradicts it wherever the two disagree. `disableRules` replaces
that list rather than merging into it, so pass `[]` to hand contrast back to axe.

`incomplete` is returned rather than dropped. It is where axe puts text over a
background image, a partially obscured element, and anything below the fold —
assert that its rule ids stay within a reviewed list, or those findings live
unread in a section of the report nobody opens.

`tags` defaults to `WCAG_AA_TAGS` — WCAG 2.0/2.1/2.2 at A and AA. Pass
`COMPREHENSIVE_TAGS` to add axe's `best-practice` rules: the landmark structure
checks (`region`, `landmark-unique`, `landmark-no-duplicate-*`),
`focus-order-semantics` and `page-has-heading-one`. Not required by any
conformance level, and the failures are real — two unlabelled `<nav>` landmarks
read as "navigation" twice with nothing to tell them apart. AAA and
`experimental` stay out of both: `color-contrast-enhanced` is superseded by
`auditContrast`, and a gate that fails on an aspiration gets turned off.

`include` and `exclude` take one selector per root — the package calls axe once
per entry, because an array argument means a frame chain, not a set of roots.

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
pnpm test        # vitest, over the .ts sources
pnpm test:watch
pnpm typecheck   # tsc --noEmit over src, test and the config files
pnpm check       # the shipped tokens against their own defaults
pnpm build
```

There is no build step between editing a source file and running the suite.
`tsconfig.json` is the project an editor and `typecheck` read, and covers
everything; `tsconfig.build.json` narrows it to `src` for tsdown.

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
