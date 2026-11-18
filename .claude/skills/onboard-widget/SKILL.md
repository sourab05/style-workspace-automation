---
name: onboard-widget
description: Onboard a new widget into the Style Workspace automation framework end to end - the Widget type union, WIDGET_CONFIG, WIDGET_STRUCTURE_MAP, canvas/preview/mobile selectors, token slots, the variant CSV, the mobileMapper block, the mobile spec file, the npm script, and the Studio page instances. Use when a new widget needs test coverage, when a component has design tokens but no framework coverage, or when the user asks to add a widget to the framework.
---

# Onboard a New Widget

Takes a widget from "has design tokens" to "fully tested on canvas, preview, Android and iOS".

This is change class 7 in
[docs/09-AI-WORKFLOW-ARCHITECTURE.md §4](../../../docs/09-AI-WORKFLOW-ARCHITECTURE.md#4-the-change-impact-matrix)
and the automation of the manual sequence in
[docs/04-ADDING-NEW-WIDGETS.md](../../../docs/04-ADDING-NEW-WIDGETS.md).

> **Status:** `scripts/onboard-widget.ts` is **not yet implemented**. This skill currently drives the
> sequence below using existing scripts plus targeted edits. Do not claim the scaffolder ran.

---

## IMPORTANT: Agent rules

- **Do all ten steps or report which you skipped.** A widget wired into 9 of 10 places produces
  passing tests that silently cover nothing — the failure mode this framework exists to prevent.
  Specifically: a token type missing from `allowedTokenTypes` makes the matrix generator skip it
  entirely, with no error.
- **Copy an existing spec; never write one from scratch.** `mobile.button.token.validate.spec.ts` is
  the reference. The payload-traversal logic must match the widget's structure type.
- **The Studio project must actually contain the widget instances** named in the CSV. Without them the
  RN style commands return empty and every test fails confusingly. **This step needs a human** — there
  is no `provision-studio-page` script, and it cannot be faked in the repo.
- **Derive token slots, do not invent them.** Use `token-slot-delta` against the foundation repo.
- **Run in the user's terminal, not a sandbox.**

---

## Finding candidates

```bash
npx ts-node scripts/derive-token-slots.ts --unmapped --tokens-root /path/to/wavemaker-foundation-css
```

Components with design tokens but no framework coverage. As of the last run there are 12; only
`left-nav` (6 derivable slots), `page-content` (2) and `textarea` (1) have real slots — the other nine
have near-empty override files and are not worth onboarding yet.

---

## The ten artifacts

Nothing is optional. The classifier lists exactly these in `reports/repair-plan.json` for a
`new-widget` action.

| # | File | What to add |
|---|------|-------------|
| 1 | `src/matrix/widgets.ts` | widget name in the `Widget` union |
| 2 | `src/matrix/widgets.ts` | `WIDGET_CONFIG` entry: `appearances`, `variants`, `states`, `allowedTokenTypes` |
| 3 | `src/matrix/widgets.ts` | `WIDGET_STRUCTURE_MAP` entry |
| 4 | `src/matrix/widget-xpaths.ts` | canvas XPath per appearance-variant-state combination |
| 5 | `src/matrix/widget-xpaths.ts` | preview selectors + `mobileWidgetSelectors` for android and ios |
| 6 | `wdio/config/widget-token-slots.json` | `tokenSlots` entry |
| 7 | `tests/testdata/mobile/<widget>-widget-variants.csv` | variant name → Studio instance name |
| 8 | `wdio/utils/mobileMapper.ts` | `if (widget === '<name>')` block with RN path mappings |
| 9 | `wdio/specs/mobile.<widget>.token.validate.spec.ts` | mobile spec, copied from an existing one |
| 10 | `package.json` | `test:mobile:<widget>` script |

Plus, outside the repo: **widget instances in the Studio project**, one per variant combination.

---

## Sequence

### 1. Decide the structure type

This determines the payload shape and is the most common source of "the payload applied but nothing
changed".

| Structure type | When | Examples |
|---------------|------|----------|
| `variant-groups` | appearances → variantGroups → variant → stateStyles (most widgets) | button, panel, label |
| `direct-mapping` | flat mapping, no variant nesting | accordion, anchor, webview |
| `appearance-mapping` | per-appearance mapping, no variant groups | cards, formcontrols |
| `hybrid-mapping` | both root-level and appearance-specific | navbar |

Read the widget's Component.json in the foundation repo: if `<key>.appearances.*.variantGroups` exists
it is `variant-groups`; if only `<key>.mapping` exists it is `direct-mapping`; if
`<key>.appearances.*.mapping` without variantGroups, `appearance-mapping`.

Also check whether the payload key differs from the widget name — `button` → `btn`, `cards` → `card`,
`radioset` → `radiobutton`, `modal-dialog` → `modal`, `form-wrapper` → `form`,
`dropdown-menu` → `dropdown`. The root key of Component.json *is* the payload key.

### 2. Discover appearances, variants and states

Not derivable from Component.json — the Style Workspace UI is the only source.

```bash
WM_ENV=stage-ai npm run scrape:slots -- --widgets <widget>
npm run scrape:slots:diff
```

Read `discoveredConfig` in `reports/scraped-token-slots.json`. Use the `style-workspace-scraper` skill;
if the URL slug differs from the config key, add it to `WIDGET_URL_SLUG` in the scraper.

### 3. Derive token slots

```bash
npx ts-node scripts/derive-token-slots.ts --widget <widget> --json --tokens-root <path>
```

Paste the `tokenSlots` array into `wdio/config/widget-token-slots.json`, or approve the diff.
Then ensure `allowedTokenTypes` in `WIDGET_CONFIG` lists **every** tokenType present — use the
`sync-widget-token-types` skill. A missing type is silently skipped by the matrix generator.

### 4. Find canvas XPaths

```bash
npm run diagnose:selectors -- --widget <widget>
```

Pattern is `{widget}-{appearance}-{variant}-{state}`. Canvas XPaths use WaveMaker attributes
(`@name`, `@widgettype`); preview uses `@data-testid` / `@aria-label` with the convention
`{prefix}{N}_{subElement}`.

### 5. Create the Studio instances and the CSV

One instance per variant combination on the widget's Studio page, then map them:

```csv
variantName,studioWidgetName
<widget>-filled-primary-default,<prefix>1
<widget>-filled-primary-disabled,<prefix>2
```

`variantName` must match the `widget-xpaths.ts` key exactly. `studioWidgetName` must match the real
instance name. Verify with the style inspector before trusting it:

```
wm.App.appConfig.currentPage.Widgets.<prefix>1._INSTANCE.styles
```

### 6. Add the mobileMapper block

`wdio/utils/mobileMapper.ts` is a single `mapToRnStylePath()` with per-widget `if` blocks. Add one:

```typescript
if (widget === '<widget>') {
  if (activePathStr === 'background') return 'root.backgroundColor';
  if (activePathStr === 'color') return 'root.color';
  // ...
}
```

Discover the real paths rather than guessing:

```bash
npx ts-node scripts/verify-rn-mappings.ts --widget <widget>
```

Use the `verify-rn-style-mapping` skill and take paths from the `--wm-` trace. Without a block the
widget falls through to the generic `root.*` fallback, which is usually wrong.

### 7. Create the mobile spec

Copy `wdio/specs/mobile.button.token.validate.spec.ts` and change: `widgetKey`, the batch payload
filename (`.test-cache/batch-payload-<widget>.json`), the CSV filename, and the payload traversal to
match the structure type from step 1.

`WidgetTokenConfigRegistry` reads `widget-token-slots.json` automatically — no manual registration.

### 8. Add the npm script

```json
"test:mobile:<widget>": "rm -rf allure-results && RUN_LOCAL=false MOBILE_PLATFORM=both wdio run wdio/config/wdio.browserstack.conf.ts --spec wdio/specs/mobile.<widget>.token.validate.spec.ts"
```

### 9. Verify before testing

```bash
npx ts-node scripts/verify-preview-token-console.ts --widget <widget>
npx ts-node scripts/verify-token-bindings.ts --widget <widget>
```

Every slot must return a real value — not `{}`, `[]`, empty or an error.

### 10. Baselines and first run

```bash
npm run test:mobile:setup                          # builds baseline + actual apps
TEST_WIDGETS=<widget> npm run test:slots:canvas    # web smoke
npm run test:mobile:<widget>                        # device
```

---

## Verification checklist

Report honestly against this list; do not tick anything you did not verify.

- [ ] `Widget` union includes the widget
- [ ] `WIDGET_CONFIG` has correct appearances, variants, states
- [ ] `allowedTokenTypes` lists **every** tokenType in the widget's token slots
- [ ] `WIDGET_STRUCTURE_MAP` entry matches the actual payload shape
- [ ] Canvas XPaths exist for every appearance-variant-state combination
- [ ] Mobile selectors exist for android **and** ios
- [ ] `widget-token-slots.json` entry derived from the foundation repo, not invented
- [ ] CSV variant names match `widget-xpaths.ts` keys exactly
- [ ] Studio project contains every instance the CSV names
- [ ] `mobileMapper.ts` block exists and paths verified against the `--wm-` trace
- [ ] Mobile spec created from a template with matching traversal logic
- [ ] npm script added
- [ ] Preview console returns real values for every slot
- [ ] Canvas smoke test passes
- [ ] Device test passes

---

## Common failure modes

| Symptom | Cause |
|---------|-------|
| Tests pass but nothing was really tested | a tokenType missing from `allowedTokenTypes` |
| Style command returns empty | `studioWidgetName` in the CSV does not exist on the Studio page |
| Payload applied, no visual change | wrong `WIDGET_STRUCTURE_MAP` entry |
| Element not found on canvas | XPath pattern mismatch, or a sub-element suffix that does not exist |
| Every RN value wrong | no `mobileMapper` block — falling through to the generic `root.*` fallback |
