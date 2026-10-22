---
name: verify-rn-style-mapping
description: Verify RN style mappings and token slot bindings against live or saved styles objects. Two use cases — (1) verify/update mobileMapper.ts path mappings by fetching live styles from the RN preview, (2) verify every token slot in widget-token-slots.json is bound as a value inside the styles object (with full state coverage). Use when token slots have changed, new widgets are added, RN style mappings need audit, after token scraper finds new slots (incremental mobileMapper updates via --new-slots-only), or when the user wants to confirm CSS variables are actually applied as values (not just declared as keys) in both default and state-prefixed namespaces.
---

# Verify RN Style Mapping & Token Slot Bindings

Two complementary verifications against the WaveMaker RN runtime styles:

| Use case | Script | Source | Purpose |
|----------|--------|--------|---------|
| **A. Mapping verification** | `scripts/verify-rn-mappings.ts` | Live (deploy + browser) | Audit `mobileMapper.ts` paths against `--wm-` trace bindings |
| **A′. Incremental mapping (new slots only)** | `scripts/verify-rn-mappings.ts --new-slots-only` | Live or cached | Map only properties in `reports/new-token-slots.json` — never touch existing mappings |
| **B. Slot binding verification** | `scripts/verify-token-bindings.ts` | Offline (saved JSON) | Confirm every token slot's CSS var is bound as a value, in all state namespaces |

---

## Read first: facts a new agent needs (learned Oct 2026)

**What the numbers mean**
- `verified` in a mapping report means a `__trace` binds the token's CSS var at that exact RN path. Nothing weaker.
- A preview with no tokens applied has no traces and omits unset properties. So "no trace" and "no output" there do NOT prove a mapping is missing. Judge by the Jenkins result instead: an empty `Actual` on a test that ran with tokens applied is real (high confidence); a wrong value with no trace is low confidence; a test that passed on Jenkins is a false positive in the report.
- The mapping report has no state-specific entries. `states.active.*` and `states.disabled.*` rows are never verified by it. Strip the `states.<state>.` prefix only to look up the slot, and say the state is unchecked.
- Shorthand slots (`padding`, `border.radius`) are bound as shorthands in the trace but resolve to per-side keys; the mapper picks the first side or corner. Count those as verified, with that caveat.

**Where test evidence lives (use two sources and require them to agree)**
- Allure: `data/test-cases/*.json`. Name format `Android: validate {token} @ <instance> [<property>]`; `statusMessage` holds `Expected: X, Actual: Y`; parameter `Style Command` holds the exact command.
- Jenkins console log (`#N.txt`): `Test failed|passed: Android: validate {token} @ <instance> [<prop>]`, with the `Error: Style verification failed ... Expected, Actual` line right after a failure. Test IDs match 1:1 between the two.
- Infrastructure failures (`element ("~label2_caption") still not displayed`, timeouts, nav-link not found) are not token results. Never count them as failed tokens.

**Instance mapping bugs**
- `tests/testdata/mobile/<widget>-widget-variants.csv` maps each variant-state to a Studio instance. Two variants pointing at the same instance (chips2 was both elevated-default and filled-disabled) make a whole state read the wrong widget; all chips `disabled` tests failed with default values for that reason.
- `getWidgetTypeFromStudioNameOrCommand` in `wdio/pages/MobileWidget.page.ts` must match `dialog`/`modal` anywhere in the instance name (`confirmdialog1`). A name that falls through to type `other` uses the generic input and output selectors and never finds `~label2_caption`.

**Do not clobber the full report**
- `verify-rn-mappings.ts --widget X` overwrites `artifacts/rn-styles/mapping-report.json` with only that widget. Copy the full report first. A full run takes about 12 minutes.
- After an in-place deploy the preview page shows "Preview is being generated" and the script waits only 60 s, which gives `wm is not defined`. That is not a stale cookie (`.test-cache/auth.json` belongs to another domain and is harmless). Poll `<previewUrl>/rn-bundle/` with `.test-cache/auth-cookie.txt` until that text is gone (about 1 to 5 minutes), then pass `--preview-url`.

**Why the existing apply path cannot re-test the Jenkins rows**
- `verify-preview-token-console.ts --apply` reads `.test-cache/batch-payload-<widget>.json`, which can be months old, and `.test-cache/slot-test-cases.json` holds different tokens from the ones the pipeline picked (the pipeline selection is in `wdio/specs/mobile.global.setup.ts`). Its "value match" counts compare against whatever stale payload is on disk.
- To re-test exactly what Jenkins ran, use `scripts/retest-rows-preview.ts`, which builds payloads from the Allure tokens. Phases: `--build` (offline, writes `.test-cache/retest-payloads/<widget>.json`), `--apply` (writes them to the Studio project; back up each widget's current override first with `getComponentOverride`), `--deploy` (in-place deploy and wait for readiness), `--evaluate` (same command as the tests, token value compared with the output; writes `artifacts/retest/retest-results.json`). Its input is `.test-cache/retest-input.json` (rows, Allure pairs, regenerated pairs for rows that never had a test).
- `--apply` overwrites the tokens currently applied to those widgets in the shared stage project. The pipeline does the same on every run, but ask the user before doing it.

**Re-test results and how to read them (Oct 22 2026 run of `retest-rows-preview.ts`)**
- Cross-check every preview result against the Jenkins result for the same instance, property and token before trusting it. Agreement was 120 of 157 comparable rows. The disagreements were all "Jenkins passed, preview returned nothing": `datetime` (17), `tabs` (17), `tabbar` `border.radius` and `list` `template.padding`. The device specs read `datetime` through the picker (`~label2_caption`) and `tabs` through their own flow, and shorthand slots (`root.borderRadius`, `root.padding`) are not set on the resolved object. Label those `HARNESS MISMATCH` and ignore them; they are not mapping bugs.
- Every global `margin.*` and `gap.*` token resolves to `4px` (14 tokens, one value), the same as the RN default. A pass on a margin or gap token proves nothing about the mapping; call it a weak pass. Opacity tokens are percentages (`12%`, `100%`) while RN returns fractions, so do not compare them.
- Global token values: generate `token-values-mobile.json` from a foundation zip with `generate-token-values.ts mobile` run from a temp directory that contains `tokens/mobile/global` copied from the zip (`cwd` decides the input and the `Tokens/` output). Compare it with the repo's `Tokens/token-values-mobile.json` instead of overwriting it. The Oct 21 stage-ai zip gave an identical 267-entry map.
- After `--apply` the shared stage Studio project keeps the applied tokens. Each widget's previous override is saved in `.test-cache/retest-backup/<widget>.json`; restore one with `updateComponentOverride(<component key>, <saved json>)`.
- A fix in `tests/testdata/mobile/*.csv` only reaches Jenkins once it is pushed. The chips `disabled` failures were the wrong instance (`chips2`); with `chips3` the preview reproduces the expected values.

**The three-outcome rule and the device-equivalent harness (use this for final answers)**
- Report every token row as exactly one of `PASS`, `FAIL` or `NOT MAPPED`. Do not add weak, strong, harness or confidence labels.
  - `PASS`: the value read from the preview equals the applied token's resolved value.
  - `FAIL`: the token's CSS var IS bound in a `__trace` on that instance (so the token is applied) but the value is wrong or the mapped path returns nothing. The token is not working.
  - Refinement: if a row would be NOT MAPPED but the mapper path already equals the path implied by the foundation `.less` rule (shorthand `padding`/`border*`/`margin` count as equal to their longhand sides) and the value is still wrong, it is `FAIL` (mapped per foundation CSS, token not working). NOT MAPPED then means no valid path exists: either no foundation rule binds the variable, or the path the rule implies is missing in the live styles. If the foundation path exists in the live styles but the mapper differs, update the mapper to it first and re-test.
  - `NOT MAPPED`: no `__trace` binds the token's CSS var on the instance (the match is a trace var ending in `-<property with dots as dashes>`, counted only when it appears as `var(--wm-...)` inside a trace value, not as a declared key).
  - The trace check only means something after the tokens were applied to the project and the preview rebuilt.
- Read values exactly the way the device specs do: build the command with `MobileMapper.getExtractionCommand(widget, effectivePath, studioWidgetName, 'android')` (it handles `tabs`, `cards` and `formcontrols`), strip the mapped path to get the base styles object, fetch that object once per instance, then resolve the path with `resolveStyleValue` from `wdio/utils/styleObjectResolver.ts` (it falls back from shorthand to longhand, `padding` to `paddingTop`). Reading `_INSTANCE.styles.<mappedPath>` directly gives false "no output" for `tabs` (needs `componentNode.children[3].instance.styles`), `tabbar` and `list` (shorthand). `scripts/retest-rows-preview.ts --evaluate2` does all of this and writes `artifacts/retest/retest-results-v2.json`.
- `datetime` cannot be re-tested in the preview. The device taps the picker and reads the styles the test app writes into `~label2_caption` (`[datetime-picker-auto]`), and those picker styles (`cancelBtn.text`, `selectBtn.text`, `container`) are not on `_INSTANCE.styles`. Exclude `datetime` rows from the preview re-test and use the Jenkins result for them.
- **Checking a NOT MAPPED row against foundation CSS.** The component token JSON (`src/tokens/mobile/components/<dir>/<dir>.json` in the zip; `form-controls` for formcontrols) names each slot's CSS variable in the leaf description (`CSS variable: --wm-...`). Search the `.less` files for rules that use that variable (`prop: var(--wm-x)`), derive the RN namespace from the rule's last class, and check that path against the saved live styles. Three results: no rule uses the variable (confirmed not mapped in foundation); a rule exists at the same path the mapper uses (the RN runtime simply does not apply it); a rule exists at a different path (mapping candidate, but only trust it when that path exists in the live styles, since `.less` hints are right about 16% of the time). A few slots exist in the token JSON but their description names no CSS variable (`modal-dialog` `btn.*`, `header.*`, `icon.color`, `title.color`); that does not mean the token is missing from the foundation, only that the `.less` binding cannot be looked up (the guessed `--wm-modal-*` names exist only in `styles/mobile/studio/dialogs`, not in the RN component styles). Say "cannot confirm" for those. `scripts/build-retest-csvs.py --allure-dir <dir> --foundation-root <foundation src>` builds the final three CSVs and these foundation columns from `artifacts/retest/retest-results-v2.json`.
- `modal-dialog` cannot be read either: its styles exist only while the dialog is open, so every preview read is empty and Jenkins also fails with `element ... not displayed`. Leave `modal-dialog` out of the final tables (do not call it FAIL or NOT MAPPED) and say so.
- Percent tokens (`opacity`) are fractions in RN (`12%` is `0.12`); normalise before comparing.
- Final CSVs use one status column with these three values plus a one-sentence reason, so a reader never has to decode categories.

- **Match the exact CSS variable, never a suffix.** A trace var that merely ends with the slot's suffix can belong to another slot (`--wm-form-controls-floating-font-size` is not `font.size`; `--wm-search-dropdown-border-width` is not `border.width`; for one-word slots like `color` a suffix matches every colour leaf). Take the slot's variable from the foundation token JSON description (leaf path after `mapping` must equal the slot path exactly) and count a binding only when that variable is bound. `scripts/retest-rows-preview.ts --evaluate2` records every suffix match with its variable name (`bindings`); `scripts/build-retest-csvs.py` applies the exact-variable filter.

**Keeping a preview re-test valid (learned the hard way, Oct 22 2026)**
- An in-place preview URL expires after roughly 1 to 2 hours and then returns HTTP 404. Symptom: every page logs `page.waitForFunction: Timeout 90000ms exceeded` and every read is empty, so every row looks NOT MAPPED. Before trusting a run, `curl` `<previewUrl>/rn-bundle/` with `.test-cache/auth-cookie.txt`; a 404 or "Preview is being generated" means redeploy. Run `scripts/retest-rows-preview.ts --deploy --evaluate2 ...` in one command (deploy waits for readiness, then evaluates). The tokens applied by `--apply` stay in the Studio project, so a redeploy does not need `--apply` again.
- `--evaluate2` now logs in fresh each run (the saved cookie also expires). A run where many widgets print `page load issue` is invalid: discard it, never merge it.
- `--evaluate2 --widget x` overwrites `artifacts/retest/retest-results-v2.json` with only those widgets. Copy the full file first (`retest-results-v2-<label>.json`), run the subset, then merge by replacing those widgets' results, and rebuild with `scripts/build-retest-csvs.py`.
- Mapper changes made from trace evidence are kept only when the re-test supports them: the row becomes PASS, or FAIL with the trace binding at the mapped property (the path is then proven and the token itself is not working). If the row is still NOT MAPPED after the change, revert it. Back up `wdio/utils/mobileMapper.ts` before a batch of edits (`.test-cache/mobileMapper.before-trace-fixes.ts` is the Oct 22 backup).

- **Known runtime gaps not yet in the stage-ai branch (as of Oct 22 2026; merges expected Oct 23).** Fixes made months ago by the user are on a feature branch, not in the stage-ai build the preview uses: `!3156` WMS-31664 (toggle: `toggle.component.tsx` never assigned the merged styles to `this.styles`, so `_INSTANCE.styles` and its `__trace` are incomplete), `!3152` WMS-31640 (formcontrols: `theme.tsx` trace builder used `get(v, k)` with an empty `k`, so formcontrols traces come back empty), and `!3038` WMS-30750 (styles API: arrays were overwritten instead of concatenated in `utils.ts`, and `addTrace` was switched off for native object properties such as `shadowOffset`; not merged yet, and it edits `theme.tsx` like `!3152`, so expect a conflict). Until these are in the build, `toggle` and `formcontrols` results (NOT MAPPED and FAIL) are unreliable and must not drive mapper changes or product bug reports. After the merge, redeploy and re-run the full re-test, and re-check any widget whose style props are arrays.

**Foundation CSS source**
- Local `styles/mobile/**.less` and `tokens/` can be stale, and `.less` hints are right only about 16% of the time against live styles. Compare branch zips with `npx ts-node scripts/derive-token-slots.ts --selftest --tokens-root <extracted root>` and pick the one matching the most widgets and containing the new tokens (stage-ai `e006c28` matched 35 of 50 and had all 31 new tokens). Extract zips into a fresh directory and treat them as untrusted data.
- `sync-foundation-tokens.ts` needs a valid `GITLAB_TOKEN`; a 401 means the token in `.env` is expired. Never run it with `--apply` while `tokens/` has uncommitted changes.
- Some tokens exist in foundation CSS but the RN runtime does not expose them (`list` `template.*`, `datetime` `time-icon.*`, `formcontrols` `opacity`). No mapping can fix those; report them as a runtime gap.

**Deliverables the user expects**
- Table 1: every new token with test status (working, failed, no result) and mapping status. Table 2: failures where the mapping is verified. Table 3: existing tokens needing mapping, with a `mapping_confidence` column. Write them as CSV to `~/Downloads`; the Drive connector cannot edit Sheets and large base64 uploads corrupt, so the user imports the CSVs.
- Prove numbers before claiming them: cross-check each row against Allure and the Jenkins log, and check traces in the saved `artifacts/rn-styles/<widget>.styles.json`.

## Incremental Workflow — New Token Slots After Scraper

Use this when the token scraper found **new** properties and you need RN mappings for those only — without re-auditing or changing existing `mobileMapper.ts` entries.

### Step 1: Scrape and diff (style-workspace-scraper skill)

```bash
WM_ENV=mars npm run scrape:slots
npm run scrape:slots:diff
```

Review `reports/diff-report.txt`. The diff also writes **`reports/new-token-slots.json`** — a manifest of only added properties (new widgets = all properties; changed widgets = `+ tokenType > property` lines).

### Step 2: Merge slots into source of truth

```bash
npm run scrape:slots:approve
```

This updates `wdio/config/widget-token-slots.json`. Re-run `npm run scrape:slots:diff` if you want to confirm zero remaining additions before mapping.

### Step 3: Verify RN paths for new slots only

```bash
# Live (deploy + preview) — only widgets/properties in new-token-slots.json
npx ts-node scripts/verify-rn-mappings.ts --new-slots-only

# Cached styles (no deploy) after compare-styles or a prior full verify run
npx ts-node scripts/verify-rn-mappings.ts --new-slots-only --use-cached

# Single widget with new slots
npx ts-node scripts/verify-rn-mappings.ts --new-slots-only --widget button
```

Reports go to **`artifacts/rn-styles/mapping-report-new-slots.txt`** (not the full `mapping-report.txt`).

### Step 4: Update mobileMapper.ts — ADD only, never edit existing

**Strict rules for incremental updates:**

| Report entry | Action |
|--------------|--------|
| `⚠️ UNMAPPED` for a property in `new-token-slots.json` | **ADD** a new `if` / `return` inside that widget's block |
| `✅ VERIFIED` | **Do nothing** — mapping already correct |
| `❓ UNVERIFIED` | **Do nothing** unless trace clearly shows a dedicated path and generic fallback was used |
| `❌ INVALID` for an old property | **Do nothing** in incremental mode — out of scope |
| Any property **not** in `new-token-slots.json` | **Never change** — even if the full report would flag it |

**Example** — `new-token-slots.json` adds `color > badge.background-color` on accordion:

1. Open `mapping-report-new-slots.txt`, find the `⚠️ UNMAPPED` suggestion (e.g. `→ badge.backgroundColor`).
2. In `wdio/utils/mobileMapper.ts`, inside `if (widget === 'accordion')`, **append**:
   ```typescript
   if (activePathStr === 'badge.background-color') return 'badge.backgroundColor';
   ```
3. Do **not** modify any existing accordion `return` lines.

### Step 5: Re-verify new slots only

```bash
npx ts-node scripts/verify-rn-mappings.ts --new-slots-only --use-cached
# or with --preview-url if live
```

All new properties should show `✅ VERIFIED`. If any remain `⚠️ UNMAPPED`, add mappings; do not run a full verify pass to "fix" unrelated widgets.

### Key files (incremental path)

| File | Purpose |
|------|---------|
| `reports/new-token-slots.json` | Manifest of added properties (from `scrape:slots:diff`) |
| `reports/diff-report.txt` | Human-readable scrape diff |
| `artifacts/rn-styles/mapping-report-new-slots.txt` | RN mapping report scoped to new slots only |
| `wdio/utils/mobileMapper.ts` | Append new mappings only |

---

---

## Three-way audit: mapper vs `.less` vs `__trace`

`scripts/diff-mapper-vs-less.ts` compares all three sources offline. Findings from the first full run
(2026-07-30, 946 slot properties across 50 widgets) — read these before auditing mappings by hand.

```bash
npm run tokens:mapper-diff                      # saved snapshots, reports their age
npm run tokens:mapper-diff -- --summary
npm run tokens:mapper-diff -- --widget toggle
npm run tokens:mapper-diff -- --fresh           # fetch current styles first (delegates here)
```

### `.less` is NOT a usable source for RN paths — only 31% accurate

| `.less` vs mapper | | `__trace` vs mapper | |
|---|---|---|---|
| agree | 31.3% | **trace-confirms-mapper** | **67.0%** |
| differ | 35.8% | trace-contradicts-mapper | 1.2% (11) |
| shorthand | 14.6% | trace-confirms-less | 1.3% (12) |
| ambiguous | 16.2% | trace-shorthand | 13.2% |
| no-less-rule | 2.1% | no-trace-binding | 17.3% |

The `.less` files bind `--wm-*` vars to CSS properties on classes, but the RN component tree adds
structure CSS cannot express: extra nesting (`icon.icon.color`, `body.root.backgroundColor`), instance
disambiguation (`titleIcon` vs `icon` share `.app-icon`), composite widgets
(`barcodescanner` → `button.root.*`), and divergent naming (`subheading` vs `header-subtitle`).

**So `__trace` remains the only authority.** The 339 `.less` "differs" collapse to ~23 real candidates
once the trace adjudicates — the naive `.less` rule was the noise, not the mapper.

### Candidate mapper bugs — two independent sources agree

| Widget | Property | Mapper says | `__trace` (+ `.less`) says |
|--------|----------|-------------|----------------------------|
| `toggle` | `handle.color` | `handle.color` | `handle.backgroundColor` |
| `toggle` | `handle.width` | `root.width` | `handle.width` |
| `checkbox` | `label.color/font.*/margin-left` | `text.*` | `selectedLabel.*` |
| `checkbox`, `checkboxset` | `icon.size` | `uncheckicon.icon.fontSize` | `checkicon.icon.fontSize` |
| `accordion` | `text.background.color`, `text.border.*` | `text.*` | `activeHeaderTitle.*` |
| `panel-footer` | `padding.block`, `padding.inline` | `root.*` | `header.*` |
| `dropdown-menu` | `menu.color` | `link.text.color` | `link.icon.root.color` |

**NOT bugs — do not "fix" these:** `accordion`/`search`/`toggle` `border.radius` and `border.width`.
The trace lists 6–10 paths (all four corners, plus sub-namespaces) and the mapper deliberately picks
one. That is the shorthand convention, working as intended.

**Unconfirmed:** these rest on snapshots from May–June. Re-run with `--fresh` once the preview build is
healthy before editing anything.

---

## Gotchas in this script — learned the hard way

1. **It exits 0 even when it fetches nothing.** A per-widget failure is recorded in the report and
   execution continues, so the process still succeeds. Anything downstream that trusts the exit code
   will silently use stale snapshots — this produced verdicts from 41-day-old data during testing.
   `diff-mapper-vs-less.ts --fresh` now records snapshot mtimes before the run and refuses to report
   unless they advanced. **Apply the same check in any new caller.**

2. **`.test-cache/preview-url.json` is write-only.** The script always calls `inplaceDeploy()` unless
   `--preview-url` is passed; it *writes* that cache but never *reads* it. Deleting the file to "force a
   fresh deploy" does nothing — the deploy was already fresh.

3. **Use `WM_ENV=stage-ai`** (project `…9d41cfdf019d482aa382004c`, user `testuser1.rn@wavemaker.com`).
   A second profile `stage-ai-jeevan` points at a different project on the same host; snapshots from the
   two are not comparable.

4. **`wm is not defined` → SOLVED: it is a stale auth cookie.** Not the build, not the URL, not
   `new Function`. `.test-cache/auth-cookie.txt` persists across runs *and accounts*; with a stale one
   the RN bundle never loads and the symptom looks exactly like a broken build (navbar selector times
   out at 60s, every style read fails).

   **Fix: delete `.test-cache/auth-cookie.txt` before a live fetch**, especially after switching
   `WM_ENV`. After a fresh login the same code path works at t=1s.

   Ruled out, so don't re-chase: the build (URL renders fine in a browser), URL construction (matches
   `gotoPreview`), `new Function`/CSP (works at t=1s), cookie *propagation* (correct at line 371 and
   608/616/624), project/account.

5. **Readiness gate.** With a valid cookie `window.wm` appears ~1–2s but `currentPage.Widgets`
   populates ~**7s**. `typeof wm !== 'undefined'` is therefore NOT sufficient — poll
   `Object.keys(wm.App.appConfig.currentPage.Widgets).length > 0`.

6. **Page name = the last URL fragment**, lowercase widget name. `#/toggle` resolves and yields
   `toggle1`. `WIDGET_PAGE_NAME_MAP`'s fall-through to the raw widget name is correct; the gallery's
   capitalised captions are display text, not page names.

7. **`__trace` only carries var bindings when tokens are APPLIED.** This is a prerequisite, not a bug.
   On a clean project the theme resolves every var to a literal, so there is nothing to trace:

   ```json
   "handle": { "__trace": [{ "name": "@app-theme:app-toggle.handle", "value": { "color": "#4263eb" } }] }
   ```

   No `var(...)` → no binding → trace verdicts are **unavailable, not negative**. Apply tokens first:

   ```bash
   npx ts-node scripts/verify-preview-token-console.ts --widget <w> --apply
   npm run tokens:mapper-diff -- --widget <w> --fresh
   ```

   `diff-mapper-vs-less.ts` detects the all-`no-trace-binding` case and prints this, so nobody reads
   "0% confirms-mapper" as "the mapper is broken".

8. **RETRACTION — `toggle/handle.color` is NOT a mapper bug.** Reported earlier as highest-confidence
   because `.less` and a 78-day-old trace both said `handle.backgroundColor`. Fresh data:
   `handle.color` = `#4263eb` (exists, themed), `handle.backgroundColor` **does not exist**. The mapper
   is right. Treat every `.less`-only finding as unverified until a token-applied trace confirms it —
   `.less` measured 31% accurate.

   Still suspect: `toggle/handle.width` — mapper reads `root.width` (52, whole toggle) where
   `handle.width` (16) exists. Both paths are real; needs a token-applied trace to settle.

---

## IMPORTANT: Agent rules

- **Always use graphify before grep.** When searching for code context (e.g. finding where a widget is mapped, understanding mobileMapper structure), first run `graphify query "<question>"` or `graphify explain "<concept>"`. Only fall back to Grep if graphify returns no results.
- **Always run commands in the user's terminal, NOT in the sandbox.** All scripts in this project require network access to WaveMaker Studio domains. The Cursor sandbox blocks these requests. When running any command from this skill, use `required_permissions: ["all"]` in the Shell tool call to bypass the sandbox, or provide the command to the user to run manually.
- **Always verify token slots exist before updating mobileMapper.ts.** Before adding or changing any mapping, confirm the property exists in `wdio/config/widget-token-slots.json` (the source of truth). Load the file and check that the widget has the exact `tokenType > property` entry. If the property is NOT in the token slots file, do NOT add a mapping for it — skip it and report it as "not in token slots".
- **Never fabricate or assume verification status.** When cross-checking mappings against token slots or the diff report, read the actual file content — do NOT claim a property "already existed", "is present", or "was verified" from memory. Every claim must be backed by tool output (Grep, Read, or Shell). If you cannot produce evidence, say "unverified" instead of guessing. Specifically:
  - Check `reports/diff-report.txt` to distinguish `+` (added) vs `-` (removed) properties before claiming status.
  - If a property was removed (`-` in diff), do NOT add a new mapping for it. If an existing mapping references it, flag it as dead code.
  - If a property was added (`+` in diff), confirm it landed in `wdio/config/widget-token-slots.json` before mapping.
- **Always trigger a fresh in-place deploy** — never reuse a cached preview URL from `.test-cache/preview-url.json`. Delete the cache file or let the script re-deploy. The styles object must reflect the latest theme state.
- **Never run `scrape:slots:approve`** without explicit user confirmation. Always show the diff report and ask first.

---

## Use Case A — RN Style Path Mapping (live)

## When to Use

- Token slots have been added, removed, or changed (check `reports/diff-report.txt`)
- New widgets need RN style path mappings
- User asks to verify, audit, or fix RN style mappings
- User asks to update `mobileMapper.ts` after token slot changes

## Data Sources (all in-repo)

| File | Purpose |
|------|---------|
| `wdio/config/widget-token-slots.json` | Source of truth: all token slots per widget |
| `tests/testdata/mobile/*.csv` | Maps variant names to studio widget instance names |
| `wdio/utils/mobileMapper.ts` | Current RN style path mappings (`mapToRnStylePath`) |
| `src/matrix/widgets.ts` | `Widget` type and `WIDGET_CONFIG` |
| `src/playwright/helpers.ts` | `WIDGET_PAGE_NAME_MAP` for preview page URLs |
| `.env` | Studio credentials, project ID, base URL |

## Workflow

### Step 1: Run the verification script

```bash
# Default: performs fresh login + fresh deploy
npx ts-node scripts/verify-rn-mappings.ts

# Single widget:
npx ts-node scripts/verify-rn-mappings.ts --widget button

# Provide preview URL directly (skips deploy):
npx ts-node scripts/verify-rn-mappings.ts --preview-url https://stage-platform.wavemaker.ai/run-xxxxx/ProjectName_master

# ── Offline / cached mode (no browser, no auth, no deploy) ──────────────────
# Read from local snapshots saved by compare-styles.ts (artifacts/style-comparison/*.local.json)
npx ts-node scripts/verify-rn-mappings.ts --use-cached

# Single widget from local cache:
npx ts-node scripts/verify-rn-mappings.ts --use-cached --widget button

# Use remote snapshots instead of local:
npx ts-node scripts/verify-rn-mappings.ts --use-cached --styles-suffix remote

# Use a custom directory (e.g. rn-styles dir saved by verify-rn-mappings itself):
npx ts-node scripts/verify-rn-mappings.ts --use-cached --styles-dir artifacts/rn-styles --styles-suffix styles

# Headless mode (live only):
npx ts-node scripts/verify-rn-mappings.ts --headless
```

**`--use-cached` mode**: Skips all auth / deploy / browser steps. Reads styles from
`artifacts/style-comparison/{widget}.local.json` (produced by `compare-styles.ts`).
Mirrors them to `artifacts/rn-styles/{widget}.styles.json` for report consistency.
Use this when you've already run `compare-styles.ts` and want instant mapping verification
without re-deploying.

**Auth flow (live mode only)**: Always performs a fresh `googleBrowserLogin()` to avoid stale cookies.

**Deploy URL flow**:
1. Uses `--preview-url` if provided
2. Otherwise runs `studioClient.inplaceDeploy()` with 3 retries, caches URL for all widgets

**Style fetching** (browser console via `page.evaluate()`):
1. Navigates to `{deployUrl}/rn-bundle/#/{pageName}` with `ensureAuthCookies()`
2. Waits for `RN_LOADED_SELECTOR` to confirm the RN app is fully initialized
3. Runs `wm.App.appConfig.currentPage.Widgets.{name}._INSTANCE.styles` in the browser console
4. Uses `wm.` prefix because the RN app exposes its runtime on `window.wm`
5. Gets the **full styles object** (no truncation risk vs the Style Inspector UI)
6. Saves full styles JSON to `artifacts/rn-styles/{widget}.styles.json`

### Step 2: Review the report

The report (`artifacts/rn-styles/mapping-report.txt`) has **five categories** per widget:

| Category | Icon | Meaning |
|----------|------|---------|
| **Verified** | ✅ | Mapping confirmed by `--wm-` trace (source of truth) |
| **Unverified** | ❓ | Path resolves to a value but no `--wm-` trace confirms it |
| **Invalid** | ❌ | Mapping is wrong — trace points to a different path, or path doesn't exist |
| **Unmapped** | ⚠️ | Generic fallback or namespace not found — needs explicit mapping |
| **Missing from slots** | 🆕 | Found in `--wm-` trace but not in `widget-token-slots.json` |

**How matching works** (deterministic, not fuzzy):
- Token property `border.style` → expected CSS var suffix `-border-style`
- Looks for trace bindings where `cssVar` ends with exactly that suffix
- e.g. `--wm-btn-border-style` ends with `-border-style` → match
- If no trace match, falls back to scanning the styles object for the camelCase property name (e.g. `borderStyle`)

### Step 3: Update invalid mappings in mobileMapper.ts

After review, update `wdio/utils/mobileMapper.ts` using the report suggestions:

#### How mobileMapper.ts is structured

The file contains a single `MobileMapper.mapToRnStylePath()` method with per-widget `if` blocks:

```typescript
if (widget === 'button') {
  // Button-specific property → RN path mappings
  if (activePathStr === 'background') return 'root.backgroundColor';
  if (activePathStr === 'color') return 'text.color';
  if (activeTop === 'border') {
    if (prop === 'style') return 'root.borderStyle';
  }
  // ...
}
```

Each widget has its own section starting with `if (widget === '{widgetName}')`.

#### Update procedure for invalid mappings

For each `❌ INVALID` entry in the report:

1. **Read the suggestion** — the report shows the correct path from `--wm-` trace or styles scan
2. **Find the widget's section** in `mobileMapper.ts` (search for `if (widget === '{widgetName}')`)
3. **Find the specific mapping** — locate the `return` statement that produces the wrong mapped path
4. **Replace with the suggested path** from the report

**Example** — report says:
```
❌ color > color → text.color
   Reason: Mapped to "text.color" but trace says "root.color"
   Suggested: → root.color  (--wm-btn-color: color) = "#FFFFFF"
```

Find in mobileMapper.ts:
```typescript
if (activePathStr === 'color') return 'text.color';
```
Change to:
```typescript
if (activePathStr === 'color') return 'root.color';
```

#### Update procedure for unmapped tokens

For each `⚠️ UNMAPPED` entry:

1. **Check the suggestion** — if trace/styles scan provides a path, use it
2. **Add a new mapping** inside the widget's `if` block in `mobileMapper.ts`
3. If no suggestion exists, check `artifacts/rn-styles/{widget}.styles.json` for the correct namespace and property

#### Validation rules

- **Only update** mappings flagged as `❌ INVALID` — these have wrong paths
- **Only add** mappings flagged as `⚠️ UNMAPPED` — these fall through to generic
- **Do NOT change** `✅ VERIFIED` mappings — these are confirmed correct
- **Review** `❓ UNVERIFIED` mappings manually — path exists but trace doesn't confirm
- **Incremental mode** (`--new-slots-only`): follow the [Incremental Workflow](#incremental-workflow--new-token-slots-after-scraper) — ADD unmapped new slots only; ignore invalid/unverified for old properties
- When a suggestion shows **multiple paths** (e.g. `header.color`, `activeHeader.color`), pick the one that matches the token's semantic intent (usually the first/primary namespace)
- Cross-reference `artifacts/rn-styles/{widget}.styles.json` to verify the suggested path exists

#### After updating, re-run verification

```bash
# Re-run for updated widgets to confirm fixes
npx ts-node scripts/verify-rn-mappings.ts --widget button --preview-url <cached-url>
```

The `--preview-url` flag reuses the cached deploy URL (from `.test-cache/preview-url.json`) to skip re-deploy.

## Browser Console Command Format

Commands are executed via `page.evaluate()` in the browser console with the `wm.` prefix.
This returns the **full styles object** without truncation (unlike the Style Inspector UI).

```javascript
// Standard widgets (uses .styles)
wm.App.appConfig.currentPage.Widgets.{studioWidgetName}._INSTANCE.styles

// Cards widget (uses .calcStyles + nested path)
wm.App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.calcStyles

// FormControls widget (uses .calcStyles + nested path)
wm.App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.entestkey.calcStyles
```

The `wm.` prefix is required because the RN app exposes its runtime on `window.wm` in the browser's global scope.

## Widget Page Name Resolution

Most widgets use their name as the page name. Exceptions are defined in `WIDGET_PAGE_NAME_MAP` in `src/playwright/helpers.ts`. Key mappings:

| Widget | Page Name |
|--------|-----------|
| formcontrols, form-wrapper | formC |
| navbar, tabbar | Main |
| picture | Picture |
| carousel | Carousel |
| button-group | ButtonGroup |
| icon | Icon |
| progress-bar | ProgressBar |
| progress-circle | ProgressCircle |
| dropdown-menu | DropdownMenu |
| modal-dialog | ModalDialog |
| fileupload | FileUpload |
| calendar | Calendar |
| (all others) | same as widget name |

## Navigating the Styles Object

The fetched styles JSON is nested. To verify a mapped path like `header.backgroundColor`:

```javascript
stylesObj['header']['backgroundColor'] // must exist and not be undefined
```

For deeply nested paths like `button.icon.icon.color`:
```javascript
stylesObj['button']['icon']['icon']['color']
```

## Output Artifacts (use case A)

| File | Content |
|------|---------|
| `artifacts/rn-styles/{widget}.styles.json` | Full raw styles object from RN preview |
| `artifacts/rn-styles/mapping-report.json` | Verification results per widget (JSON) |
| `artifacts/rn-styles/mapping-report.txt` | Human-readable summary with suggestions |
| `artifacts/rn-styles/mapping-report-new-slots.json` | Same as above, scoped to `reports/new-token-slots.json` (`--new-slots-only`) |
| `artifacts/rn-styles/mapping-report-new-slots.txt` | Human-readable new-slots-only report |

---

## Use Case B — Token Slot Binding Verification (offline)

Verifies that every token slot defined in `wdio/config/widget-token-slots.json` has its CSS variable **bound as a value** (not just declared as a key) inside the RN styles' `__trace[].value` entries. Also checks that the binding is present in **every state-prefixed sibling namespace** that exists in the styles (so `badge` AND `activeBadge` both bind `--wm-accordion-badge-background-color`).

### When to Use

- Confirm new/updated token slots are actually applied at runtime
- Find tokens that were defined in slots but never wired up in the theme
- Find state-coverage gaps (e.g. `chip` binds the var but `activeChip` doesn't)
- Quick offline check after `compare-styles.ts` has saved style snapshots

### Run the Script

```bash
# All widgets (reads artifacts/style-comparison/{widget}.local.json by default)
npx ts-node scripts/verify-token-bindings.ts

# Single widget
npx ts-node scripts/verify-token-bindings.ts --widget accordion

# Use remote-fetched snapshots instead of local
npx ts-node scripts/verify-token-bindings.ts --source remote

# Use a different styles directory (e.g. those produced by verify-rn-mappings.ts)
npx ts-node scripts/verify-token-bindings.ts --styles-dir artifacts/rn-styles --suffix styles
```

Reads pre-saved styles JSON only — no auth, no deploy, no browser. Generate the snapshots first with `compare-styles.ts` (see `compare-rn-styles` skill).

### What "Bound as a Value" Means

Wanted pattern (var applied to a real RN property):
```json
"badge": {
  "__trace": [{ "value": {
    "backgroundColor": "var(--wm-accordion-badge-background-color)"
  }}]
}
```

Rejected pattern (var declared but never applied):
```json
"badge": {
  "__trace": [{ "value": {
    "--wm-accordion-badge-background-color": "transparent"
  }}]
}
```

### Matching Logic

Property → expected CSS var suffix:
- `badge.background-color` → suffix `-badge-background-color`
- `background`              → suffix `-background`

A binding counts when any `--wm-*` ending in that suffix appears as a value inside a `__trace[].value` entry. Widget prefix is auto-discovered (button → `--wm-btn-*`, accordion → `--wm-accordion-*`).

### State Coverage

States are discovered from top-level styles keys via PascalCase prefix detection: `activeBadge` → state `active`, base namespace `badge`. Recognised state prefixes: `active`, `disabled`, `hover`, `focused`, `checked`, `on`, `selected`, `current`.

For each property's bindings, the script groups them by base namespace. If the base namespace has the binding but a sibling state namespace (e.g. `activeBadge`) exists in the styles and **doesn't** have the binding, it's flagged as a state-coverage gap.

### Report Categories

| Status | Meaning |
|--------|---------|
| `✅ verified` | Var is bound as a value in every applicable state namespace |
| `⚠️ partial`  | Bound in some namespaces but missing in sibling state namespaces that exist |
| `❌ unbound` | No `--wm-*` ending in the expected suffix is bound as a value anywhere in the styles |

### Output Artifacts (use case B)

| File | Content |
|------|---------|
| `artifacts/token-bindings/binding-report.json` | Per-widget results (machine-readable) |
| `artifacts/token-bindings/binding-report.txt`  | Human-readable summary, grouped by widget, showing unbound vars and state-coverage gaps |
