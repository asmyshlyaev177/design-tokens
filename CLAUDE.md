# design-tokens

OKLCH design tokens shared by asmyshlyaev177.dev, state-in-url,
test-proxy-recorder, react-horizontal-scrolling-menu and x-profile-location.
Published to npm; consumers `@import` the CSS and run `check-tokens` in their
own gate. Documented at <https://asmyshlyaev177.dev/design>.

```bash
pnpm test        # 25 tests, runs the .ts sources directly (node strips types)
pnpm typecheck   # tsc --noEmit over src and test
pnpm check       # the shipped tokens against their own defaults
pnpm build       # tsdown -> dist/
```

## Distribution

`tokens.css` is published **twice**: `dist/tokens.css` and again at the package
root. postcss-import — which every Tailwind v3 project runs — resolves with the
classic CJS algorithm and ignores `exports` entirely, so it looks for the
literal root path and nothing else. state-in-url fails to build without it.
`src/index.ts` reads `./tokens.css` relative to itself, which is why the source
lives in `src/` and the build copies it beside `dist/index.mjs`.

**`bin` paths must not start with `./`.** npm 12 silently strips such entries
from the published manifest (`"bin[x]" script name … was invalid and removed`),
so `npx check-tokens` disappears with no error.

## Build

TypeScript, `.ts` extensions on relative imports so node runs the sources
without a build step. `tsc` alone is not enough: `rewriteRelativeImportExtensions`
rewrites the JS but leaves `.ts` specifiers in the emitted `.d.ts`, which breaks
consumer type resolution. tsdown bundles the declarations, so those specifiers
vanish. Optional peers (`@playwright/test`, `lighthouse`, `playwright-lighthouse`)
must stay external and dynamically imported — a CSS-only consumer installs none
of them.

## What a project may change

Exactly two axes, both set in the consuming stylesheet after the import:

1. `--brand-hue` / `--accent-hue` / `--neutral-hue`.
2. `--font-sans` / `--font-display` / `--font-mono`.

**This file declares no `--font-*` at all, deliberately.** Tailwind puts
`@theme` variables in `@layer theme`, and an unlayered `:root` rule beats a
layered one at any order, so a fallback here would silently outrank the real
families every project sets for itself.

The contract holds at **every hue on the wheel**, asserted at 72 five-degree
steps — the ramp fixes lightness and chroma per token and varies only hue.

## The contract

`check-tokens <stylesheet>` reads the hue knobs out of the file it is pointed
at and measures 38 pairs in both themes. The check runs in the consuming repo
because the knobs are the one thing each project changes; a central test that
hardcoded them would vouch for a configuration a project may no longer have.

Grounds are `--bg`, `--surface`, `--surface-2`. `--surface-2` is the one that
decides it — the lightest ground a token can legitimately sit on. Measuring
against `--bg` alone flatters everything, which is how a `--ink/55` tint once
shipped as body text at 3.99:1.

Every pair must clear **both** WCAG 2 and APCA. Neither alone describes reading
comfort.

### APCA status

**APCA is not a standard.** It is an independent algorithm proposed as a
candidate for WCAG 3. The [WCAG 3 draft](https://github.com/w3c/wcag3) does not
adopt it, does not mention it anywhere in the repository, and still carries
`@@[contrast measure to be determined]` as its requirement text. WCAG 2 AA is
the normative gate. APCA is the second opinion, and it is the one that catches
dark-theme regressions: WCAG 2 applies one formula to both polarities and
flatters light-on-dark, so this system shipped a dark `--muted` at 6.0:1 —
past AA without argument — that APCA rates Lc 42.

`src/apca.ts` reimplements APCA 0.1.9 so consumers install nothing;
`test/apca.test.ts` pins it against the official `apca-w3` devDependency.

### Lc floors

This package's own numbers, calibrated against what shipping design systems
reach — not from any specification. APCA's Lc 75 body-text floor is unreachable
for _coloured_ text on a dark ground: at this ramp's chroma `--link` needs
L 0.975, which is a near-white tint rather than a brand colour.

|                 | dark secondary | dark link |
| --------------- | -------------- | --------- |
| GitHub Primer   | 44             | 44        |
| Tailwind        | 52             | —         |
| IBM Carbon      | 71             | 55        |
| Material 3      | 72             | 72        |
| **this system** | **74**         | **71**    |

Floors: 70 secondary text, 60 coloured text, 45 icon/large-text, 90 body.

## Rules the ramp encodes

Each was a real bug first.

- **`--muted`, not an alpha tint.** A token's contract is checked; a tint's is
  not. `/50` and `/55` measure 3.43:1 and 3.99:1.
- **`--link` is not `--primary`.** `--primary` is a _fill_, held dark enough
  that `--on-primary` clears AA on top of it. At cyan no single lightness is
  both that and readable as a link. Both halves carry their own value: light
  deferred to `--primary` until the ground stopped being near-white, at which
  point it measured 4.49:1.
- **`--accent-on-soft` for accent-coloured text, never `--accent`.** Same split,
  one family over. `--accent` at 10-12px measures 4.19:1 on `--surface-2`.
  Icons and display-size headings keep the fill — they are held to 3:1.
- **The light ground is not white.** `--bg` at L 0.972 with `--ink` at ~16:1,
  rather than the ~21:1 of black on white. The softening is in the ground; the
  text tokens were re-solved against it rather than left to drift under it.

## Themes

Both ramps live in one `light-dark()` per token. Three traps, all of which bit:

- `light-dark()` takes exactly **two** arguments. A shadow is itself a
  comma-separated list, so it is the _colour_ that gets wrapped, never the whole
  list — wrap the list and the call is silently dropped.
- **The opt-in selectors must be `:root`-prefixed.** Unscoped,
  `[data-theme="light"]` matches any element using the attribute for its own
  purposes; a theme menu labelling its buttons `data-theme="light|dark|system"`
  rendered each one in that theme.
- **An explicit light choice needs an explicit class.** The default is
  `color-scheme: light dark`, so removing `.dark` means "ask the OS", not
  "be light".

Lightning CSS lowers `light-dark()` into `--lightningcss-light` /
`--lightningcss-dark` pairs. That is transparent — don't chase it in built CSS.

## Releasing

Conventional commits; release-please opens the PR, merging publishes with
provenance. Provenance requires CI — `npm publish` from a laptop fails with
`Automatic provenance generation not supported for provider: null` _after_
printing the whole tarball listing, which reads like success.

A token rename or removal is breaking for every consuming stylesheet: `feat!:`
or a `BREAKING CHANGE:` footer. Adding a token is `feat:`; retuning a value is
`fix:` when it repairs a contrast failure.
