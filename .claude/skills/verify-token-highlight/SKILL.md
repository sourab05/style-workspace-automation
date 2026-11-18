---
name: verify-token-highlight
description: Verify the Style Workspace canvas-click → token highlight UX. Navigates every widget style page, selects a variant, clicks each part of the widget rendered in the canvas, and checks the right-hand token panel highlights the token rows for that part. Use when validating this UX enhancement, when a widget stops highlighting tokens on click, or to find token rows that no canvas part maps to.
---

# Verify Canvas-Click Token Highlight

## IMPORTANT: Agent rules

- **Always use graphify before grep.** Run `graphify query "<question>"` or `graphify explain "<concept>"` first; fall back to Grep only if graphify returns nothing.
- **Always run commands in the user's terminal, NOT in the sandbox.** These scripts need network access to WaveMaker Studio domains, which the sandbox blocks. Use `required_permissions: ["all"]` or hand the command to the user.
- **Run `--selftest` after touching any in-page snippet.** It is offline and takes seconds.
- **Never widen a failure into a product fix.** A failure here is a report. Fix product code only when asked.
- **A `0 rows` / `navigation` result is a flake, not a finding.** Re-run that widget alone before believing it.
- **`unreachable-tokens` is a finding, not necessarily a bug.** Read the "Interpreting unreachable tokens" section before filing anything — three distinct causes produce the same symptom.

## What It Verifies

The enhancement: clicking a part of a widget in the Style Workspace canvas highlights only the token rows that style that part. Clicking the button root highlights `background`/`padding`/`radius`…; clicking `span.btn-caption` highlights the `text/*` rows; clicking `i.app-icon` highlights `icon.color` + `icon.size`.

Per widget × variant × state:

| Check | Fails when |
|-------|-----------|
| `no-token-rows` | the token panel rendered no rows — bad `variant=` param or nav failure |
| `no-canvas-parts` | `.variant-preview-container` never rendered |
| `no-highlight` | parts were clicked and nothing ever highlighted — feature missing for that widget |
| `unreachable-tokens` | token rows no canvas part ever highlights — listed by name in the report |
| `overlay-opened` | a click opened a Studio modal/popover, so remaining parts went unverified |

Warnings (reported, never fail): `no-discrimination` — every mapped part highlights the same full row set, so nothing narrows the selection. This is *not* flagged when a widget simply has one part that owns all its tokens (`picture` is a single `img`, `container` a single `div`); that is correct behaviour, and an earlier per-part "highlighted everything" check produced 8 false failures before being replaced by this whole-widget version.

`ripple.*` and `skeleton.*` are classified **expected-unreachable** and do not fail: they only exist during a press animation or a loading state, so no static canvas element can own them. `--strict` makes them fail too.

The patterns are `/\bripple[.\-]/` and `/\bskeleton[.\-]/` — deliberately unanchored and accepting either separator, because the product spells them `ripple.color`, `button.ripple.color`, `close-btn.ripple.color` *and* `ripple-color`. An anchored pattern silently failed five widgets; the self-test now pins both the match set and an over-match guard (`tooltip.background` must stay a real failure).

**Not yet classified** — hover-only and state-only tokens still counted as real failures, pending a product decision: `tooltip.*` (`progress-bar`, `slider`), `error.*` (`login`), `placeholder.color` / `floating.*` (`formcontrols`). Roughly 14 tokens. Add them to `EXPECTED_UNREACHABLE` only on an explicit call, not by inference.

## Run

```bash
# Offline logic check — no auth, no network, seconds
npm run verify:highlight:selftest

# See the actual part → token mapping for one widget (start here)
npx ts-node scripts/verify-token-highlight.ts --explore button

# One widget, first variant, default state
npm run verify:highlight -- --widgets button

# All widgets, first variant of the first appearance (~40s per widget)
npm run verify:highlight

# Full sweep: every appearance:variant and every state
npm run verify:highlight -- --all-variants --states
```

Auth comes from `.env` (`WM_ENV`, `AUTH_METHOD`); the browser runs headed via a persistent profile. Exit code is `1` when any check fails, so it drops into CI as-is.

| Flag | Default | Purpose |
|------|---------|---------|
| `--widgets a,b` | all of `WIDGET_CONFIG` | limit widgets |
| `--all-variants` | off (first combo) | every `appearance:variant` from `WIDGET_CONFIG` |
| `--states` | off (`default`) | loop every state via `select.variant-state` |
| `--strict` | off | count `ripple.*`/`skeleton.*` as failures |
| `--explore <widget>` | — | print every part and what it highlights, + screenshot |
| `--selftest` | — | offline check of the in-page logic |

## Confirmed DOM (stage-platform, Aug 2026)

```
div.widgets-preview                        canvas container, sibling of the token panel
  div.widget-info                          widget name + "+ Add Variant"   ← NEVER CLICKED
  div.canvas-markup-container
    …  div.variant-preview-container       the rendered widget instances = the clickable parts
         div[wmlayoutgrid] …               preview harness layout (skipped)
           span.header-title               appearance label, e.g. "filled" (skipped)
           p.preview-label                 variant label, e.g. "default"  (skipped)
           button.btn.app-button…          the widget — a real part
             i.app-icon…                   a real part
             span.btn-caption              a real part
div.widget-tokens-panel
  div.category-list                        scrollable; sections lazy-render
    div.styleConfigCard
      label.config-card-header             COLOR | SIZE | TEXT | STYLE
      div.token-item[.token-highlighted]   ← THE HIGHLIGHT MARKER
        div.token-name > span              property name
```

Row keys in the report are `<section>/<property>`, e.g. `color/background`, `text/font-size`.

**Highlight is exclusive** — clicking a part clears the previous part's highlight — so each click is read straight off `.token-item.token-highlighted`. No baseline diffing, no reloads between parts. Visually the class adds background `#f3f7fd`, a `#1794ef` inset left border, and label color `#1794ef` at weight 800.

**Do not click `.widget-info`.** Its "+ Add Variant" button opens `.wm-add-custom-variant-dialog`, which stays open and covers the canvas, silently invalidating every later click. Scoping to `.variant-preview-container` is what prevents this; the `overlay-opened` check is the backstop.

Clicks are dispatched as `pointerdown → mousedown → pointerup → mouseup → click` directly on the element, so hit-testing cannot redirect the click to a child or a stray overlay. There are no iframes.

**Page readiness — do not reintroduce `networkidle` or fixed sleeps.** Studio holds connections open, so `waitUntil: 'networkidle'` timed out at 90s on `icon` while the page had rendered in seconds, and the fixed `waitForTimeout` that followed let `slider` and `rating` be read with an empty panel and reported as `no-token-rows`. `openWidgetPage()` instead loads on `domcontentloaded`, waits for `.token-item` and `.variant-preview-container`, then polls until the lazily-rendered row count stops changing, retrying once. Three false failures per 50-widget sweep became zero.

## Interpreting unreachable tokens

Three different causes, same symptom. The `inert (…)` list in the report is what tells them apart — an inert part sitting next to an unreachable token that clearly belongs to it is the strong signal.

| Pattern | Cause | Action |
|---------|-------|--------|
| an inert part exists whose name matches the unreachable token (accordion's `i.wi.wi-minus` inert while `color/icon.color` is unreachable) | **product gap** — that part has no click handler | file against the enhancement |
| the token's element is not in the canvas at all (popover's `content.*`/`header.*` — the popover body never renders; clicking the trigger opens nothing) | **canvas coverage gap** — no surface exists to click | file against the canvas preview, not the highlight feature |
| the token needs a state the preview doesn't show (`label`'s `asterisk.color` needs a required label; `ripple.*`, `skeleton.*`) | **not a bug** | add to `EXPECTED_UNREACHABLE` in the script if permanent |

## Baseline (stage-platform, Aug 2026 — all 50 widgets, first variant, default state)

`22 pass / 28 fail · 218 of 967 token rows never highlighted · 13 expected-unreachable · 2 warnings · 0 flakes`

Two consecutive sweeps differed only on the three widgets that had flaked before the readiness fix, so these numbers are reproducible. Use the table to tell a regression from a known gap.

| Widget | Missing / rows | Inert parts | Reading |
|--------|---------------|-------------|---------|
| `search` | 36 / 56 | 3 | result/dropdown list absent from canvas |
| `popover` | 27 / 43 | 0 | popover body never renders; clicking the trigger opens nothing |
| `carousel` | 17 / 52 | 1 | slide + indicator sub-parts absent |
| `navbar` | 12 / 40 | 8 | badge and nav-item parts |
| `calendar` | 10 / 47 | **104** | 101 parts map, 104 highlight nothing — `event-day*` colors |
| `accordion` | 9 / 43 | 11 | `i.wi.wi-minus` inert while `color/icon.color` missing — **product gap** |
| `formcontrols` | 8 / 29 | **57** | floating label + placeholder |
| `list` | 8 / 14 | 6 | all `template.*`; heading/description inert |
| `radioset` | 8 / 20 | 3 | label/title parts |
| `wizard` | 8 / 39 | 9 | step icon/description |
| `checkbox` | 7 / 12 | 4 | |
| `toggle` | 7 / 13 | 1 | `handle.*` |
| `progress-bar` | 7 / 11 | 0 | all `tooltip.*` — see unclassified note above |
| `chips` `message` `select` | 6 each | | |
| `tabbar` `checkboxset` | 5 each | | |
| `anchor` `login` `slider` | 4 each | | `login` has 20 inert parts against 5 rows |
| `bottomsheet` `lottie` | 3 each | | |
| `spinner` `modal-dialog` `video` | 2 each | | `video` maps no parts at all |
| `label` `form-wrapper` | 1 each | | `label`: `asterisk.color` needs a required-label instance |

Passing (22): `button` `panel` `cards` `picture` `barcodescanner` `tabs` `switch` `container` `tile` `button-group` `webview` `progress-circle` `dropdown-menu` `audio` `fileupload` `camera` `currency` `datetime` `panel-footer` `accordion-pane` `icon` `rating`

Warnings (not failures): `audio`, `panel-footer` — `no-discrimination`.

**How to read the inert column.** A high inert count next to missing tokens points at a product gap: `calendar` (101 mapped, 104 inert), `formcontrols` (26 mapped, 57 inert) and `login` (1 mapped, 20 inert) have many clickable elements that highlight nothing. Where inert is 0 and missing is high — `popover`, `progress-bar`, `tabbar` — the elements owning those tokens are simply not in the canvas, so no click can ever reach them; that is a canvas-coverage gap, not a highlight bug.

## Reports

| File | Purpose |
|------|---------|
| `artifacts/token-highlight/token-highlight-report.json` | `missingTokens` keyed by widget, plus per-part `highlighted` arrays — the machine-readable part→token map |
| `artifacts/token-highlight/token-highlight-report.txt` | **MISSING TOKENS PER WIDGET** section first (every unhighlighted row named, with the inert parts beside it), then expected-unreachable, then the full part→token detail |
| `artifacts/token-highlight/explore-<widget>.json` / `.png` | `--explore` output |

## Key Files

| File | Purpose |
|------|---------|
| `scripts/verify-token-highlight.ts` | the verifier; in-page snippets and the `--selftest` fixture are at the top and bottom |
| `src/auth/studioBrowser.ts` | shared authenticated Studio browser context (also used by the scraper) |
| `src/matrix/widgets.ts` | `WIDGET_CONFIG` — the widget/appearance/variant/state matrix driving the sweep |

## Related Skills

- `style-workspace-scraper` — same page and token-panel selectors; use it if the variant/state matrix looks stale
- `token-slot-delta` — derive token slots from `Component.json` when the panel and the registry disagree
