---
name: triage-token-failures
description: Triage token validation failures across mobile (Allure/WDIO) and web (Playwright) results, classifying each as a framework gap, a product bug, or an environment flake, and routing it to the skill that can fix it. Use after a failed test run or Jenkins build, when the user asks why tests failed, whether a failure is a real bug, or what to fix next.
---

# Triage Token Failures

Turns a pile of failures into a small number of causes, each with an owner.

The central question is always: **is the framework wrong, or is the token change wrong?** Getting this
backwards wastes days — either chasing a product bug that is really a stale XPath, or "fixing" the
framework to accommodate a genuine regression.

---

## IMPORTANT: Agent rules

- **Classify before counting.** 400 failures with one cause is a one-line fix; 400 failures with 40
  causes is a different conversation. Cluster first.
- **Never call something a product bug without ruling out the framework.** The check order below is
  not optional: a wrong RN mapping and a genuine token regression look identical in the report.
- **Every claim needs tool output.** Quote the actual expected-vs-actual from the report. Do not
  characterise a failure from its test name.
- **A mass failure is almost never a mass product bug.** If an entire widget or token type failed, look
  for one shared cause — a missing mapping, an unpublished deploy, an expired session.
- **Run in the user's terminal, not a sandbox.**

---

## Inputs

| Source | Path |
|--------|------|
| Web per-widget results | `artifacts/playwright-token-reports/preview/<widget>-report.json` |
| Web summary | `artifacts/playwright-token-reports/preview/overall-summary.json` |
| Web HTML | `reports/playwright-report.html` (`npm run report:generate`) |
| Device results | `allure-results/` → `npm run allure:generate` → `allure-report/` |
| Jenkins run record | `.test-cache/jenkins-run.json` |
| Applied token payloads | `.test-cache/batch-payload-<widget>.json` |
| Extracted RN styles | `artifacts/mobile-styles/<variant>.json` |

For the web half, the `analyze-report-failures` skill already documents the JSON schema and clustering
queries — use it and do not duplicate that work here.

---

## Classification

Work top-down. Stop at the first that fits.

### 1. Framework gap — the test is wrong

| Signal | Cause | Route to |
|--------|-------|----------|
| Value returns `{}`, `[]`, empty, or `CONSOLE_ERROR` | RN style path wrong or missing | `verify-rn-style-mapping` (add/fix the mapping) |
| **Every** property of one widget fails | no `mobileMapper` block — generic `root.*` fallback | `verify-rn-style-mapping` |
| A whole token type fails for a widget | type missing from `allowedTokenTypes`, or slot never registered | `sync-widget-token-types`, `token-slot-delta` |
| "Element not found" on canvas | stale XPath, or a sub-element suffix that does not exist | `diagnose:selectors` |
| Style command returns empty for one variant | `studioWidgetName` in the CSV is not on the Studio page | fix the CSV / Studio page |
| Expected value is `undefined` in the report | the slot is in the registry but the token was never applied | inspect `.test-cache/batch-payload-<widget>.json` |
| Failure appeared right after a slot was added | the repair was incomplete | back to `test-with-ai` step 3 |

### 2. Product bug — the framework is right

Only after every check above is ruled out. The signature is: the mapping is `✅ VERIFIED`, the token
**was** applied (present in the batch payload), the RN path returns a **real** value — and that value
does not match the token.

| Signal | Interpretation |
|--------|---------------|
| Real value returned, wrong value | token not wired through, or overridden downstream |
| Correct on Android, wrong on iOS (or vice versa) | platform-specific regression |
| Canvas correct, preview wrong | RN-web theme divergence — confirm with `compare-rn-styles` |
| Value equals the *default*, not the applied token | the override is not taking effect |
| Screenshot identical to baseline (mobile logic is inverted — identical means FAIL) | the token had no visual effect |

Report these against the token change with: widget, appearance/variant/state, token slot, token ref,
expected, actual, platform, and the report path.

### 3. Environment flake — neither

| Signal | Action |
|--------|--------|
| Passes on retry | flake; note it, do not fix |
| BrowserStack timeout / device queue | lower `BROWSERSTACK_MAX_INSTANCES` and rerun |
| Studio API 401 | session expired; the framework auto-retries |
| Appium connection refused | Appium not running |
| Timeout during deploy or publish | slow environment; raise the timeout |
| Whole build failed before tests | infrastructure — read the Jenkins stage, not the test results |

---

## Clustering first

Before reading individual failures, get the shape:

```bash
# Web: pass/fail per widget
python3 -c "
import json,glob,os
for f in sorted(glob.glob('artifacts/playwright-token-reports/preview/*-report.json')):
    d=json.load(open(f)); s=d['summary']
    if s.get('failedTests') or s.get('errorTests'):
        print(f\"{d['widget']:<20} fail={s.get('failedTests',0):<5} err={s.get('errorTests',0):<5} pass={s.get('passedTests',0)}\")
"
```

Then ask, in order:

1. Is it **one widget**? → likely that widget's mapper block or XPaths.
2. Is it **one token type across many widgets**? → likely the token pool or `allowedTokenTypes`.
3. Is it **one property across many widgets**? → likely a shared normalization or alias issue.
4. Is it **everything**? → infrastructure: deploy did not publish, session expired, wrong app built.
5. Is it **scattered singletons**? → only now read them individually.

---

## Output

Write `reports/triage-report.json`:

```json
{
  "run": { "source": ".test-cache/jenkins-run.json", "buildNumber": 214, "result": "UNSTABLE" },
  "clusters": [
    {
      "cause": "no mobileMapper block for widget X",
      "class": "framework-gap",
      "failureCount": 47,
      "evidence": "all 47 return {} for root.* paths — artifacts/mobile-styles/x-*.json",
      "routeTo": "verify-rn-style-mapping",
      "confidence": "high"
    }
  ],
  "productBugs": [
    {
      "widget": "button", "variant": "filled-primary-default", "platform": "ios",
      "slot": "color > background", "tokenRef": "{color.surface.value}",
      "expected": "#6200EE", "actual": "#FFFFFF",
      "rulingOut": "mapping VERIFIED; token present in batch payload; path returns a real value"
    }
  ],
  "flakes": [],
  "unexplained": []
}
```

`unexplained` must not be hidden. An unexplained failure is a real finding — say so rather than
forcing it into a category.

---

## Verdict

Report one of exactly three, matching the `test-with-ai` contract:

| Verdict | When |
|---------|------|
| ✅ **Pass** | no failures, or only confirmed flakes |
| 🐞 **Product bug** | at least one failure survived every framework check |
| 🔧 **Framework gap** | failures trace to mapping / selector / registry problems |

If both a product bug and a framework gap are present, report the framework gap first — fix the
framework, rerun, and only then judge the remaining failures. A product bug diagnosed on top of a
broken framework is not trustworthy.


## Learned rules for classifying (Oct 2026)

- **Exclude infrastructure failures before counting token failures.** `element ("~label2_caption") still not displayed after 15000ms`, 300 s timeouts and `nav link not visible` are environment or framework-navigation problems. In the Oct 19 run they were 40 of 177 failures; 38 were `modal-dialog` caused by an instance rename that broke widget-type detection (framework gap).
- **A whole state failing with default values points at the wrong instance, not 13 token bugs.** Check the variants CSV first (all `chips` `disabled` tests read `chips2`, a non-disabled instance).
- **A token with no result is a coverage gap, not a pass.** Missing `allowedTokenTypes` (gap, margin, icon, elevation) silently removes tests. Run `sync-widget-token-types` and regenerate test cases.
- **Report "mapping needs work" only with evidence.** HIGH: the Jenkins `Actual` was empty, or a trace names a different path. LOW: the path returned a value and only the trace is missing. FALSE POSITIVE: the test passed on Jenkins. See `verify-rn-style-mapping` for how to cross-check Allure and the Jenkins log.
- **Product or runtime gap:** the token exists in foundation CSS but the live RN styles have no such namespace (`list` `template.*`, `datetime` `time-icon.*`). Classify as product, not framework.
- **"Did it pass before?" needs evidence.** Look in the Allure report's `history/history.json` (entries keyed by `historyId`, each with prior `items` and statuses) and `history/history-trend.json`. A fresh Jenkins job has one run only, so there is nothing to compare and the honest answer is "unknown". Do not revert slot or mapper changes on the assumption that something used to work. Example: `icon` `height`/`min-width`/`width` failed under both the old `icon` type and the new `space` type tokens, and no earlier result existed.
- **Manual overrides to slots are lost on the next scrape approve.** `text-transform` slots were removed on purpose (not tested), so re-check `widget-token-slots.json` after each `scrape:slots:approve` and run `sync-widget-token-types`.

- **Final status vocabulary is PASS, FAIL, NOT MAPPED only.** FAIL means the token is bound in the trace but the value is wrong; NOT MAPPED means no trace binds it. Infrastructure failures are not token results and are left out. See `verify-rn-style-mapping` ("three-outcome rule") for how each is decided.
