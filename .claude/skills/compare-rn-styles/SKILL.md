---
name: compare-rn-styles
description: Fetch RN style objects for all widgets from the stage-platform WaveMaker project (https://stage-platform.wavemaker.ai, project WMPRJ2c9180879d41cfdf019d482aa382004c) and from a local RN preview (http://localhost:19009), then deep-compare both objects and report differences. Use when the user wants to compare remote vs local widget styles, detect style regressions, audit style parity between environments, or understand what changed between a deployed build and a local dev build.
---

# Compare RN Styles (Remote vs Local)

## IMPORTANT: Agent rules

- **Always use graphify before grep.** When searching for code context, first run `graphify query "<question>"` or `graphify explain "<concept>"`. Only fall back to Grep if graphify returns no results.
- **Always run commands in the user's terminal, NOT in the sandbox.** All scripts in this project require network access to WaveMaker Studio domains. The Cursor sandbox blocks these requests. When running any command from this skill, use `required_permissions: ["all"]` in the Shell tool call to bypass the sandbox, or provide the command to the user to run manually.

Fetches widget style objects from two RN preview environments and reports every structural and value difference, ignoring internal `__trace` metadata.

## Sources

| Source | Default URL |
|--------|-------------|
| **Remote** | Stage-platform (auto-deployed via `inplaceDeploy`, project `WMPRJ2c9180879d41cfdf019d482aa382004c`) |

> **Project note.** Two `stage-ai` profiles exist on the same host in `config/wm-env-profiles.json`:
> `stage-ai` (project `…9d41cfdf019d482aa382004c`, user `testuser1.rn@wavemaker.com`) and
> `stage-ai-jeevan` (project `…c721827019c757fb4ee0023`, user `jeevan.inaparti@wavemaker.com`).
> **Use `stage-ai` — the testrnuser project.** This skill previously hardcoded the jeevan project ID,
> which meant its style snapshots were not comparable with every other script's. Always set
> `WM_ENV=stage-ai` rather than relying on a hardcoded ID.
| **Local**  | `http://localhost:19009` (local RN bundle dev server) |

## Run the Script

```bash
# Full run — deploys remote, fetches all widgets, compares
npx ts-node scripts/compare-styles.ts

# Single widget
npx ts-node scripts/compare-styles.ts --widget button

# Skip deploy — provide a cached remote preview URL
npx ts-node scripts/compare-styles.ts --remote-url https://stage-platform.wavemaker.ai/run-xxx/ProjectName_master

# Use a different local port
npx ts-node scripts/compare-styles.ts --local-url http://localhost:8080

# Headless browser
npx ts-node scripts/compare-styles.ts --headless

# Re-compare using cached JSON (no browser, fast)
npx ts-node scripts/compare-styles.ts --skip-fetch-remote --skip-fetch-local
```

## What It Does

1. **Auth** — logs in to `stage-platform.wavemaker.ai` via `.env` credentials (Google or WaveMaker form login)
2. **Deploy** — calls `inplaceDeploy()` with the project ID; caches the URL in `.test-cache/preview-url.json`
3. **Fetch remote** — for each widget, navigates to `{remoteBase}/rn-bundle/#/{pageName}`, waits for the RN app to load, then runs `wm.App.appConfig.currentPage.Widgets.{name}._INSTANCE.styles` via `page.evaluate()`
4. **Fetch local** — same approach for `http://localhost:19009/rn-bundle/index.html#/{pageName}`; no auth needed
5. **Deep diff** — recursively compares both style objects, including `__trace` arrays (CSS variable bindings and their resolved values)
6. **Report** — writes JSON + human-readable TXT to `artifacts/style-comparison/`

## Output Artifacts

| File | Content |
|------|---------|
| `artifacts/style-comparison/{widget}.remote.json` | Full remote styles object |
| `artifacts/style-comparison/{widget}.local.json` | Full local styles object |
| `artifacts/style-comparison/comparison-report.json` | Machine-readable diff results |
| `artifacts/style-comparison/comparison-report.txt` | Human-readable summary |

## Interpreting the Report

| Symbol | Meaning |
|--------|---------|
| `✅ Identical` | Widget styles are exactly the same (ignoring `__trace`) |
| `🔄 VALUE CHANGES` | Property exists in both but the resolved value differs |
| `🔴 ONLY IN REMOTE` | Property/namespace exists in remote but is absent locally |
| `🟢 ONLY IN LOCAL` | Property/namespace exists locally but is absent in remote |
| `❌ Fetch error` | Could not load styles (widget page missing, auth failure, etc.) |

## Common Diff Patterns

| Pattern | Likely Cause |
|---------|-------------|
| Many `🔄 VALUE CHANGES` on color/background | Token values differ between deploys (theme/token update) |
| `🔴 ONLY IN REMOTE` — entire namespaces | New widget variants deployed remotely that aren't in local build |
| `🟢 ONLY IN LOCAL` — new properties | WIP local changes not yet deployed |
| Fetch errors on all local widgets | Local dev server not running; start with `npx react-native start` or equivalent |
| Fetch errors on all remote widgets | Auth failure or stale deploy URL; re-run without `--remote-url` |

## Prerequisites

`.env` must contain:
```
STUDIO_BASE_URL=https://stage-platform.wavemaker.ai
PROJECT_ID=WMPRJ2c9180879d41cfdf019d482aa382004c
STUDIO_USERNAME=...
STUDIO_PASSWORD=...
```

Local RN preview must be running at `http://localhost:19009` before the script starts.

## Caching Workflow

After a full run, use `--skip-fetch-remote` and/or `--skip-fetch-local` to re-run the diff against cached JSON without re-deploying or re-launching the browser:

```bash
# Make local changes, re-fetch only local, re-compare
npx ts-node scripts/compare-styles.ts --skip-fetch-remote

# Re-compare without any network calls
npx ts-node scripts/compare-styles.ts --skip-fetch-remote --skip-fetch-local
```
