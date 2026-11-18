---
name: token-slot-delta
description: Derive token slots from Component.json in the wavemaker-foundation-css repo (or the live Studio project), diff them against widget-token-slots.json, and apply approved additions. Use when token slots may have changed, after a design-token release, when asked which token slots are new or missing, to find coverage gaps where a design token exists but no test covers it, or to check whether the framework registry is in sync with the latest tokens. This is the deterministic alternative to UI scraping for token slots.
---

# Token Slot Delta

Derives what token slots *should* exist from the design tokens themselves, and compares that against
what the framework actually tests.

Backing script: `scripts/derive-token-slots.ts`.

---

## IMPORTANT: Agent rules

- **Never derive from the in-repo `tokens/` mirror when a better source is available.** It is a
  snapshot that goes stale between token releases. Measured on a full selftest of 50 widgets:

  | Source | Exact match | Spurious additions |
  |--------|-------------|--------------------|
  | in-repo `tokens/` mirror | 16 | 105 |
  | foundation-css repo | 31 | 49 |

  The mirror makes a correct registry look broken. Always pass `--tokens-root` or `--live`.
- **Never apply removals.** The script refuses to, by design. A removal that is really staleness
  deletes real coverage while every test keeps passing.
- **Show the diff before `--approve`.** `--approve` requires `--yes`; `--yes` requires the user to
  have seen the diff.
- **Every claim needs tool output.** Do not report a property as "already covered" from memory.
- **Run in the user's terminal, not a sandbox.** `--live` needs network access to Studio.

---

## Sources, in order of preference

| Flag | Source | Use when |
|------|--------|----------|
| `--tokens-root <path>` | a `wavemaker-foundation-css` checkout | "what did this token release change?" — **default choice** |
| `--live` | the Studio project, via `getComponentOverride()` | "what is deployed on the working env right now?" |
| *(none)* | in-repo `tokens/` mirror | offline fallback only; the tool prints a stale-mirror warning |

Set `FOUNDATION_CSS_ROOT=/path/to/wavemaker-foundation-css` in `.env` to make the good source the
default. Pass the **repo root** — the tool locates `src/tokens` itself.

Foundation repo layout:

```
src/tokens/{web,mobile}/components/<c>/<c>.json    ← Component.json (token slots live here)
src/tokens/{web,mobile}/global/                    ← global token values
src/styles/{web,mobile}/components/<c>.less        ← Component.less
```

---

## Commands

```bash
# What changed, all widgets
npx ts-node scripts/derive-token-slots.ts --diff --tokens-root <path>

# One widget
npx ts-node scripts/derive-token-slots.ts --diff --widget button --tokens-root <path>

# Live Studio project
npx ts-node scripts/derive-token-slots.ts --diff --live --widget button

# Inspect what a widget's tokens imply, without diffing
npx ts-node scripts/derive-token-slots.ts --widget button --tokens-root <path>
npx ts-node scripts/derive-token-slots.ts --widget button --json --tokens-root <path>

# Health check: does derivation agree with the hand-maintained registry?
npx ts-node scripts/derive-token-slots.ts --selftest --tokens-root <path>

# Components that have design tokens but no framework coverage (new-widget candidates)
npx ts-node scripts/derive-token-slots.ts --unmapped --tokens-root <path>

# Apply additions (additions only — never removals)
npx ts-node scripts/derive-token-slots.ts --approve --yes --widget button --tokens-root <path>

# Web tokens instead of mobile
npx ts-node scripts/derive-token-slots.ts --diff --platform web --tokens-root <path>
```

---

## How derivation works

Walks `<rootKey>.mapping` and `<rootKey>.appearances.*`, treating every leaf with a `value` as a token
slot. The dotted path to the leaf is the registry's `properties` string.

**Token type comes from `attributes.subtype`, never `type`.** This is the trap: in `button.json`,
`cursor`, `opacity`, `text-transform`, `border-width`, `border-style`, `radius`, `elevation` and
`icon-size` all carry `type: "radius"`. Only `subtype` discriminates.

| `attributes.subtype` | Framework `TokenType` |
|---------------------|----------------------|
| `color` | `color` |
| `font-size`, `font-family`, `font-weight`, `line-height`, `letter-spacing` | `font` |
| `space` | `space` |
| `radius` | `border-radius` |
| `border-width` / `border-style` | `border-width` / `border-style` |
| `elevation` | `elevation` |
| `opacity` | `opacity` |
| `icon-size` | `icon` |
| `gap`, `margin` | `gap`, `margin` |
| `cursor`, `text-transform`, layout props | skipped (not tokenized) |

Some leaves carry a subtype that does not describe them — `z-index` is declared
`subtype: "opacity"`. Those are skipped by property name via `SKIP_PROPERTY_NAMES`.

### Comparison is alias- and family-aware

`widget-token-slots.json` is hand-maintained and internally inconsistent about spelling. Across the
50 widgets it uses all of:

```
background   |  background-color  |  background.color     (same slot)
radius       |  border.radius     |  border-radius        (same slot)
border.color |  border-color                             (same slot)
icon.size    |  icon-size                                (same slot)
```

Forcing one spelling would report a phantom add *and* remove for every widget using the other. So
coverage is checked by equivalence class instead.

Directional spacing is deliberately **not** collapsed: 13 widgets keep `padding.horizontal`,
`margin.top` etc. as genuinely distinct slots. Instead a third-tier *family* check treats a derived
`padding.top` as covered when the widget already covers the `padding` family in any form.

Token types are compared **per widget across all types**, not per `(tokenType, property)` — the
registry disagrees with Component.json about which type owns `gap` and `border.width` on several
widgets. A type disagreement is reported as `tokenTypeDrift` (low severity — the slot *is* tested,
just filed elsewhere), not as a remove-plus-add.

---

## Output

| File | Contents |
|------|----------|
| `reports/framework-delta.json` | Per widget: `added`, `removed`, `tokenTypeDrift`, `unknownSubtypes`, plus `tokenSource` and `tokenSourceIsStaleMirror` |
| `reports/new-token-slots.json` | Additions only. **Existing contract** consumed by `verify-rn-mappings.ts --new-slots-only` — do not change its shape |
| `reports/derive-selftest.json` | Full `--selftest` detail |

Always check `tokenSourceIsStaleMirror` before acting on a delta.

---

## After applying additions

In this order — each step's verification depends on the previous one landing:

```bash
# 1. allowedTokenTypes must include every tokenType now in the registry, or the matrix
#    generator silently skips the new slot and it is never tested
#    → sync-widget-token-types skill

# 2. RN path mapping for the new properties only — ADD, never edit an existing VERIFIED mapping
npx ts-node scripts/verify-rn-mappings.ts --new-slots-only --widget <widget>
#    → verify-rn-style-mapping skill

# 3. Prove each new slot returns a real value in the live preview
npx ts-node scripts/verify-preview-token-console.ts --widget <widget>
#    → verify-preview-token-console skill
```

Then classify and test via the `test-with-ai` master skill.

---

## Interpreting the delta

| Category | Meaning | Action |
|----------|---------|--------|
| `added` | Component.json has a slot the registry does not cover | Real gap — apply, map, verify, retest |
| `removed` | Registry covers a slot Component.json does not mention | **Candidate only.** Confirm against the previous revision of the same file before removing anything |
| `tokenTypeDrift` | Covered, but filed under a different tokenType | Usually leave alone; only move if the wrong token pool generates its values |
| `unknownSubtypes` | A subtype with no `TokenType` mapping | Needs a code change to `SUBTYPE_TO_TOKEN_TYPE` or `NON_TOKENIZED_SUBTYPES` — until then the property is invisible to the framework |

---

## Known limitations

- `accordion-pane` and `panel-footer` are **skipped**: they are sub-components whose slots live
  namespaced inside a parent file (`panel-footer`'s `border.width` is panel.json's
  `footer.border.width`). Prefix-aware derivation is not implemented; skipping beats deriving wrongly.
- Appearances, variants and states are **not derivable** — use `style-workspace-scraper`.
- 22 of 48 derivable widgets still differ from the registry. Those differences are findings to review,
  not automatic edits.
