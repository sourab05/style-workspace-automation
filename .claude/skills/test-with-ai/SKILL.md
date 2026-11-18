---
name: test-with-ai
description: Master orchestrator for the Style Workspace token automation framework. Detects what changed in the design tokens, works out which parts of the framework must change because of it, repairs them, verifies the repair, runs the scoped tests on web and devices, and reports a verdict. Use when the user says "test it with AI", asks to test a token/widget change end to end, asks what a foundation-CSS or Component.json change affects, asks to sync the framework after a token release, or asks which framework files need updating for a new token slot or widget. Also the entry point after the Design Token Skill has added or changed Component.json / Component.less.
---

# Test it with AI — Master Orchestrator

The single entry point that turns a design-token change into a verified test result, repairing the
framework along the way so newly added tokens are never silently left untested.

Read [docs/09-AI-WORKFLOW-ARCHITECTURE.md](../../../docs/09-AI-WORKFLOW-ARCHITECTURE.md) before
making judgement calls — it holds the change-impact matrix this skill routes on.

---

## The coverage contract — read this before reporting any verdict

The two test dimensions obey **different rules**:

| Dimension | Rule |
|-----------|------|
| **Token slots** | **100% — every slot must be tested.** An invariant, not a trade. `tokenSlotGenerator.ts` exists to guarantee it. |
| **Appearance × variant × state** | **Sampled** — orthogonal/pairwise, ~25,000 → ~2,500. A deliberate, sound reduction. |

So an **uncovered slot is a defect**, while an untested variant combination is expected. Never treat a
missing slot as an acceptable reduction, and never claim exhaustive variant coverage.

Phrase verdicts accordingly:

> ✅ "All token slots for widget X tested, under the orthogonal variant sample."
> ❌ "Widget X fully tested." — ambiguous about variants.
> ❌ "100% coverage." — meaningless unless the dead-ref sweep is clean (see below).

**Coverage can overstate reality.** The metric counts a slot as covered when a test case was
*generated*. A dead token reference means the test ran but compared against `undefined` — so
`coverage: 100` can coexist with slots that verified nothing. Run `npm run tokens:dead-refs` before
believing a coverage figure.

---

## IMPORTANT: Agent rules

- **A missing token slot is a defect, not a trade-off.** See the coverage contract above.
- **Never skip the repair step.** A new token slot in Component.json is invisible to the framework
  until `widget-token-slots.json`, `WIDGET_CONFIG.allowedTokenTypes` and `mobileMapper.ts` know about
  it. Running tests without repairing first produces a green result that tested *less* than before.
  That is the worst outcome this framework can produce — worse than a red build.
- **Always derive from the foundation repo, never the in-repo `tokens/` mirror.** The mirror goes stale
  between token releases; deriving from it reports staleness as framework drift. Measured on a full
  selftest: the mirror gives 16 exact matches and 105 spurious additions, the real source gives 31 and
  49. Pass `--tokens-root <foundation-css-checkout>` (or set `FOUNDATION_CSS_ROOT` in `.env`), or use
  `--live`. If a report says `tokenSourceIsStaleMirror: true`, re-run it before acting.
- **Never auto-apply a removal.** Removals are reported as candidates and confirmed by a human. A
  wrong removal deletes real coverage while every test keeps passing.
- **Stop on `unclassified`.** If `reports/repair-plan.json` contains any action with
  `changeClass: "unclassified"`, stop and ask. Never guess a repair.
- **Every claim needs tool output.** Do not say a slot "is already mapped" or "was verified" from
  memory. Read the file or the report. If you cannot produce evidence, say "unverified".
- **Run commands in the user's terminal, not a sandbox.** Every script here needs network access to
  WaveMaker Studio, BrowserStack or Jenkins. Sandboxed shells block those.
- **Show the diff before any registry write.** `--approve` requires `--yes`, and `--yes` requires the
  user to have seen the diff.
- **Scope the test run to the delta.** A value-only change must not expand into a full-suite run
  without the user explicitly asking.

---

## Triggering

Automated triggering from the foundation CSS repo is **designed but deliberately not wired** —
pending manager sign-off (decision recorded 2026-07-30). See
[§6 of the architecture doc](../../../docs/09-AI-WORKFLOW-ARCHITECTURE.md#6-trigger-surfaces) for the
four candidate mechanisms and why "Jenkins deterministic + AI on escalation" is recommended.

For now this skill is invoked by hand:

```
/test-with-ai                    # detect across all widgets, act on what's found
/test-with-ai button             # scope to one widget
/test-with-ai --dry-run          # detect + classify + plan, change nothing
/test-with-ai --plan-only        # stop after the repair plan, don't repair or test
```

---

## The Flow

Seven steps. Do not reorder them — each gates the next.

### Step 0 — Make sure the tokens are current

Everything downstream is worthless if the token source is stale. Do this first, always.

```bash
# Is the tokens/ mirror behind the foundation repo?
npx ts-node scripts/sync-foundation-tokens.ts --check

# Pull the latest
npx ts-node scripts/sync-foundation-tokens.ts --apply
```

Exit code `10` means behind. A cron job may already be keeping this current — check
`.test-cache/foundation-tokens-sync.json` for the last synced SHA and
`.test-cache/foundation-tokens-changed.json` for a pending drift signal. See the
`sync-foundation-tokens` skill.

If you have a local foundation-css checkout, prefer pointing directly at it (`FOUNDATION_CSS_ROOT` in
`.env`) and the mirror stops mattering.

**Gate:** never proceed to step 1 on a stale mirror. Measured effect of getting this wrong: 16 exact
matches and 105 spurious additions, versus 31 and 49 against current tokens. You would spend the rest
of the flow repairing drift that does not exist.

### Step 1 — Detect

```bash
# Preferred: against a wavemaker-foundation-css checkout
npx ts-node scripts/derive-token-slots.ts --diff --tokens-root /path/to/wavemaker-foundation-css

# One widget
npx ts-node scripts/derive-token-slots.ts --diff --widget button --tokens-root <path>

# Against the LIVE Studio project ("what is deployed right now")
npx ts-node scripts/derive-token-slots.ts --diff --live --widget button

# Sanity-check the derivation itself against all 50 registry widgets
npx ts-node scripts/derive-token-slots.ts --selftest --tokens-root <path>
```

Writes `reports/framework-delta.json` and `reports/new-token-slots.json`, both stamped with
`tokenSource` / `tokenSourceIsStaleMirror`.

Choosing a source:

| Question being asked | Source |
|---|---|
| "What did this token release change?" | `--tokens-root <foundation checkout>` |
| "What is deployed on the working env right now?" | `--live` |
| Offline, no checkout available | the mirror — but say so in the verdict |

The foundation repo layout is `src/tokens/{web,mobile}/components/<c>/<c>.json` (Component.json) and
`src/styles/{web,mobile}/components/<c>.less` (Component.less). Pass the repo root; the tool finds
`src/tokens` itself.

If the delta is empty, report that plainly and stop — there is nothing to repair or retest.

### Step 2 — Classify

```bash
npx ts-node scripts/classify-framework-impact.ts
```

Writes `reports/repair-plan.json`: for every change, the change class, the exact framework files
that must be edited and why, the owning repair skill, and the retest scope.

Read the ROUTING and FRAMEWORK ARTIFACTS TO CHANGE sections of the output. That is the answer to
"what part of the framework needs to change".

**Gate:** if any action is `unclassified`, stop and ask the user.

**On `removal-candidate` entries:** report the count, take no action. These are expected — the
registry holds base-layer slots that no override file mentions. A genuine removal can only be
established by diffing the same override file across two revisions.

### Step 3 — Repair

Work through `reports/repair-plan.json` grouped by `repairSkill`. Apply in this order, because each
step's verification depends on the previous one having landed:

| Order | Change class | Route to |
|-------|-------------|----------|
| 1 | `new-widget` | `onboard-widget` skill |
| 2 | `slot-added` | `token-slot-delta` skill |
| 3 | `unknown-subtype` | `token-slot-delta` skill (needs a code change to the subtype map) |
| 4 | `token-type-drift` | `token-slot-delta` skill (low severity — ask before moving anything) |
| 5 | new appearance/variant/state | `style-workspace-scraper` for discovery, then **manual** — Studio-instance provisioning is not built. Say so rather than implying it is handled |
| 6 | global token change | `token-release-sync` skill |

After registry edits land, always:

```bash
# 1. allowedTokenTypes must include every tokenType now present in the registry,
#    or the matrix generator silently skips the new slot
#    → sync-widget-token-types skill

# 2. RN path mappings for the new properties only — ADD, never edit existing
npx ts-node scripts/verify-rn-mappings.ts --new-slots-only --widget <widget>
#    → verify-rn-style-mapping skill, incremental workflow
```

Record what was actually edited in `reports/repair-applied.json`.

### Step 4 — Verify the repair

Do this **before** spending a test run. A bad mapping wastes a full BrowserStack cycle.

```bash
# Every new slot must return a real value in the live preview — not {}, [], empty or an error
npx ts-node scripts/verify-preview-token-console.ts --widget <widget>

# The CSS var must be bound as a VALUE in the RN styles, in every state namespace
npx ts-node scripts/verify-token-bindings.ts --widget <widget>

# Is the new slot's RN path right? Compares mapper vs .less vs __trace
npm run tokens:mapper-diff -- --widget <widget>
```

**Environment:** always `WM_ENV=stage-ai` — project `…9d41cfdf019d482aa382004c`, user
`testuser1.rn@wavemaker.com`. A second profile `stage-ai-jeevan` targets a different project on the same
host and its results are not comparable.

**Two traps when reading verification output:**

- `verify-rn-mappings.ts` **exits 0 even when it fetched nothing** — it logs a per-widget error and
  carries on. Never infer success from the exit code; confirm the snapshot files actually changed.
- `.less`-derived RN paths are only **31% accurate** (measured over 946 properties). `__trace` is the
  authority. Do not "fix" a mapping because `.less` disagrees.

**Gate:** if a new slot still shows `⚠️ UNMAPPED` or returns an empty value, go back to step 3. Do
not proceed to testing with an unresolved mapping — revert the repair rather than ship it.

Use a **fresh deploy**; never reuse a cached preview URL from `.test-cache/preview-url.json`.

### Step 5 — Execute

Scope the run to the delta.

**Web (local, fast feedback):**

```bash
TEST_WIDGETS=button npm run test:slots            # canvas + preview
TEST_WIDGETS=button npm run test:slots:canvas     # canvas only
```

**Devices (Jenkins — the decided execution path):**

```bash
# Derive params straight from the repair plan
npx ts-node scripts/trigger-jenkins-build.ts --from-plan --dry-run   # inspect params first
npx ts-node scripts/trigger-jenkins-build.ts --from-plan

# Or scope explicitly
npx ts-node scripts/trigger-jenkins-build.ts \
  --widgets button,label --target "Mobile — Android + iOS" --s3-version 12.0.0
```

Always `--dry-run` first and show the user the parameter set. Requires `JENKINS_JOB` in `.env`
alongside the existing `JENKINS_URL` / `JENKINS_USER` / `JENKINS_API_TOKEN`.

Records the run in `.test-cache/jenkins-run.json`.

### Step 6 — Report the verdict

```bash
# Web failures
npm run report:generate          # → reports/playwright-report.html
                                 # → triage with analyze-report-failures skill

# Device failures → triage-token-failures skill
```

State one of exactly three verdicts:

| Verdict | Meaning | Next |
|---------|---------|------|
| ✅ **Pass** | Repairs applied and verified; scoped tests green | Ready for QA Backlog |
| 🐞 **Product bug** | Framework is correct; the token change itself misbehaves | Report against the token change, with the failing slot and expected-vs-actual |
| 🔧 **Framework gap** | A failure traced to a mapping/selector/registry problem | Back to step 3 |

Never report "pass" if step 3 or 4 was skipped. Say what was skipped instead.

---

## Deciding the retest scope

| What changed | Web | Devices |
|-------------|-----|---------|
| Token *value* only (`{radius.sm}` → `{radius.md}`), structure identical | canvas + preview, that slot | yes — a value change can alter rendering |
| Slot added | canvas + preview, that widget | yes |
| New sub-element property (e.g. `skeleton.width`) | canvas + preview, that widget | yes — also check the canvas XPath resolves |
| `token-type-drift` only | none | none — the slot is already tested |
| `removal-candidate` only | none | none |
| New widget | full, that widget | full, both platforms |
| Global token file change | every widget referencing a changed ref | yes |

---

## Owned artifacts

| Path | Written by |
|------|-----------|
| `reports/framework-delta.json` | step 1 |
| `reports/new-token-slots.json` | step 1 (existing contract — consumed by `verify-rn-mappings --new-slots-only`) |
| `reports/repair-plan.json` | step 2 |
| `reports/repair-applied.json` | step 3 |
| `.test-cache/jenkins-run.json` | step 5 |
| `reports/triage-report.json` | step 6 |

---

## Skills this routes to

| Skill | For |
|-------|-----|
| `sync-foundation-tokens` | Step 0 — keeping `tokens/` current with the foundation repo (on demand or via cron) |
| `token-slot-delta` | Registry additions, subtype map changes, type drift |
| `onboard-widget` | A component with tokens but no framework coverage |
| `sync-widget-token-types` | `allowedTokenTypes` after any registry edit |
| `verify-rn-style-mapping` | RN path mappings (incremental, add-only) + binding verification |
| `verify-preview-token-console` | Repair verification gate |
| `style-workspace-scraper` | Appearances / variants / states (the UI is the only source) |
| `run-token-tests` | Jenkins device execution |
| `triage-token-failures` | Device / Allure failure triage |
| `analyze-report-failures` | Playwright failure triage |
| `token-release-sync` | Global token file changes |
| `compare-rn-styles` | Diagnostic when step 4 fails ambiguously |

---

## Known limitations — state these rather than working around them

1. **No automated trigger.** Manual invocation only, pending sign-off.
2. **Removals are reported, never auto-applied.** Confirm each against the previous revision of the
   same Component.json before touching the registry.
3. **Derivation is not a perfect reproduction of the registry.** Against the foundation repo:
   31 of 50 widgets match exactly, 19 differ (49 uncovered properties, 21 registry-only). Treat differences as findings to review, not as automatic edits.
4. **Two widgets cannot be derived**: `accordion-pane` and `panel-footer` are sub-components whose
   slots live namespaced inside a parent file (`panel-footer`'s `border.width` is panel.json's
   `footer.border.width`). Prefix-aware derivation is not implemented; they are skipped rather than
   derived wrongly.
5. **Appearances / variants / states cannot be derived** from Component.json — the Style Workspace UI
   is the only source. Use `style-workspace-scraper`.
6. **12 component dirs have design tokens but no framework coverage** — run
   `npx ts-node scripts/derive-token-slots.ts --unmapped` to list them (`left-nav`, `page-content`
   and `textarea` have real derivable slots; the rest are near-empty).
7. **`scripts/onboard-widget.ts` is not yet implemented.** The `onboard-widget` skill currently
   drives the documented manual sequence.
