---
name: run-token-tests
description: Run scoped token validation tests on web (Playwright canvas/preview) and devices (Android/iOS via the Jenkins pipeline), deriving the run parameters from a repair plan or an explicit widget list. Use when the user wants to test specific widgets or token slots, run tests on real devices, trigger the Jenkins job, check on a running build, or asks how to scope a test run after a token change.
---

# Run Token Tests

Executes a scoped validation run and follows it to a result. Web runs locally via Playwright; device
runs go through the existing Jenkins pipeline.

Backing script: `scripts/trigger-jenkins-build.ts`.

---

## IMPORTANT: Agent rules

- **Always `--dry-run` first and show the user the parameter set** before triggering a real build.
  A mis-scoped run costs BrowserStack minutes and an hour of wall clock.
- **Never widen the scope silently.** An empty `TEST_WIDGETS` means *all* widgets. If the repair plan
  named 2 widgets, pass those 2.
- **Verify the repair before running.** A run against an unverified RN mapping wastes the whole cycle.
  See the `verify-preview-token-console` skill.
- **Run in the user's terminal, not a sandbox.** Needs network access to Jenkins and BrowserStack.
- **Do not report a pass that did not happen.** If the build is still running, say it is still running.

---

## Web (local, fast feedback)

```bash
TEST_WIDGETS=button npm run test:slots            # canvas + preview
TEST_WIDGETS=button npm run test:slots:canvas     # canvas only
TEST_WIDGETS=button npm run test:slots:preview    # preview only (headed)
TEST_WIDGETS=button,label npm run test:slots      # several widgets

npm run report:generate                           # → reports/playwright-report.html
```

`SLOT_VERIFY_TARGET` (`canvas` | `preview` | `both`) is set by those npm scripts. `PW_WORKERS`
controls parallelism — preview runs are serialized (`PW_WORKERS=1`) because they share a deploy.

---

## Devices (Jenkins)

```bash
# Derive scope + target straight from reports/repair-plan.json
npx ts-node scripts/trigger-jenkins-build.ts --from-plan --dry-run
npx ts-node scripts/trigger-jenkins-build.ts --from-plan

# Explicit scope
npx ts-node scripts/trigger-jenkins-build.ts \
  --widgets button,label \
  --target "Mobile — Android + iOS" \
  --s3-version 12.0.0

# Trigger without waiting, then re-attach later
npx ts-node scripts/trigger-jenkins-build.ts --widgets button --no-follow
npx ts-node scripts/trigger-jenkins-build.ts --build 214 --follow
```

### Required config

`.env` must have `JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN` (already used by
`scripts/refresh-jenkins-cookie.ts`) **plus `JENKINS_JOB`**, which is new:

```
JENKINS_JOB=WM-RN-Automation                    # bare job name
JENKINS_JOB=job/QA/job/WM-RN-Automation         # job inside a folder
```

The script will not guess the job name — it errors with this explanation instead.

### Parameters

Exactly the ones the existing job declares (`jenkins/pipeline-parameters.groovy`). Invalid values are
rejected before triggering rather than failing mid-build.

| Param | Flag | Notes |
|-------|------|-------|
| `WM_ENV` | `--env` | `stage-ai`, `stage-ai-jeevan`, `stage`, `dev`, `wmo`, `preprod` |
| `RUN_TARGET` | `--target` | must match a job choice exactly (see below) |
| `TEST_WIDGETS` | `--widgets` | comma-separated; **empty = all widgets** |
| `S3_VERSION` | `--s3-version` | required for report upload; empty = no upload |
| `SKIP_VISUAL_VERIFICATION` | `--visual` to disable skipping | job default is `true` (token value checks only) |
| `MOBILE_APP_SOURCE` | `--app-source` | `Build from Studio (CLI)` \| `Build with AppChef` \| `Upload APK/IPA manually` |

`RUN_TARGET` choices:

```
Web — Canvas only
Web — Preview only
Web — Canvas + Preview
Mobile — Android only
Mobile — iOS only
Mobile — Android + iOS
All — Web (Canvas+Preview) + Mobile (Android+iOS)
```

### How `--from-plan` picks a target

| Plan contains | Target |
|---------------|--------|
| any `full`-scope action (new widget, restructure) | `All — Web (Canvas+Preview) + Mobile (Android+iOS)` |
| any `slot` or `widget` scope action | `All — Web (Canvas+Preview) + Mobile (Android+iOS)` |
| nothing device-affecting | `Web — Canvas + Preview` |

Slot-scope repairs deliberately widen to the full matrix: a token change can alter canvas, preview and
both platforms, so narrowing is an explicit `--target` choice, never an inference. Under-testing after
a repair is the failure mode the framework exists to catch.

---

## Following a build

The script polls and prints each pipeline stage as it starts, so a long mobile build does not look
hung. Stages, in order: Checkout → Resolve WM Environment → Resolve Run Target → Install Dependencies
→ Build Token Map → Web (Playwright browsers, Token Slot Validation) → Setup Android Build Tools →
Mobile (Prepare Uploaded Apps, Setup CLI/AppChef, Run on BrowserStack) → Generate Allure Report.

Result is recorded to `.test-cache/jenkins-run.json` with the build number, URL, params and outcome —
consumed by the `triage-token-failures` skill.

Default follow timeout is 120 minutes (`--timeout <minutes>`). A full mobile build with two app builds
plus BrowserStack execution routinely takes over an hour.

---

## When a build fails

| Stage | Likely cause |
|-------|-------------|
| Resolve WM Environment | Jenkins credential missing for that `WM_ENV` — see `docs/JENKINS-CREDENTIALS.md` |
| Build Token Map | a token file failed schema validation |
| Web — Token Slot Validation | genuine token failures, or a stale canvas XPath |
| Mobile — Setup (CLI / AppChef) | Studio export or RN build failure; the job records `FAILURE_REASON` |
| Mobile — Run on BrowserStack | device queue, app upload, or accessibility-ID drift |

Then: `triage-token-failures` skill for device results, `analyze-report-failures` for web results.

---

## Local device runs (alternative)

Faster for iterating on one widget, no BrowserStack minutes:

```bash
npm run test:mobile:setup                       # build baseline + actual apps
npm run test:mobile:button                       # local emulator, single widget
npm run test:mobile:android                      # local emulator, all specs
npm run test:mobile:android:parallel             # multiple emulators
```

See `docs/06-MOBILE-TESTING-GUIDE.md` for emulator and Appium prerequisites.


## Reading a finished build (learned Oct 2026)

- **UNSTABLE is not failed.** `Finished: UNSTABLE` means the pipeline ran and some tests failed. Read the log from the `Mobile Token Validation` lines; `tail` shows only the report-upload stage. A trailing `Cannot resume build because FlowNode ... could not be loaded` is a Jenkins restart artifact.
- **Jenkins builds `origin/main`.** Local, uncommitted changes (mapper edits, CSVs, slots) are not used. Check the commit sha in the `git checkout -f <sha>` line against `git log` before concluding anything about your changes.
- **Report upload.** `scripts/generate-allure-single-html.ts` uses `npx allure generate --config scripts/allurerc.single.mjs` (Allure 3 has no `--single-file` flag). A bare `allure` call fails with exit 127 on the agent and the S3 upload is skipped as "non-fatal".
- **Look for these in the log:** `Android baseline app URL is empty` (baseline comparison inputs missing), `CONFIGURED BUT MISSING IN PAYLOAD` (slots with no test because `allowedTokenTypes` lacks their type; run `sync-widget-token-types`), and page-ready selector warnings (flaky navigation, not token failures).
- Re-run only the widgets you touched. Tokens that gained coverage after a type sync have no earlier result to compare with.

- **Preview re-tests are separate from Jenkins.** `scripts/retest-rows-preview.ts` (phases `--build`, `--apply`, `--deploy`, `--evaluate2`) re-tests rows in the RN preview with the exact Oct 19 tokens; see `verify-rn-style-mapping` for how to read results and why previews expire after about two hours.
