---
name: verify-preview-token-console
description: Open RN preview for widgets, evaluate wm.App console commands for every generated token-slot test case, and fail when output is empty, {}, or an error. Writes JSON, text, and HTML reports with per-widget failure tables. Use when auditing preview RN path mappings, checking token console output, or validating mobileMapper.ts against live preview.
---

# Verify Preview Token Console Output

## IMPORTANT: Agent rules

- **Always use graphify before grep.** When searching for code context, first run `graphify query "<question>"` or `graphify explain "<concept>"`. Only fall back to Grep if graphify returns no results.
- **Always run commands in the user's terminal, NOT in the sandbox.** All scripts in this project require network access to WaveMaker Studio domains (e.g. `mars-studio.wavemakeronline.com`, `stage-platform.wavemaker.ai`). The Cursor sandbox blocks these requests. When running any command from this skill, use `required_permissions: ["all"]` in the Shell tool call to bypass the sandbox, or provide the command to the user to run manually.

## When to Use

- Audit preview RN path mappings for all token slots
- Confirm every mapped token returns a real console value (not `{}`, `[]`, empty, or `CONSOLE_ERROR`)
- Produce a per-widget failure report after `mobileMapper.ts` changes

## Prerequisites

- `.env` with Studio credentials and project ID for remote preview
- Token slot test cases in `.test-cache/slot-test-cases.json` (run `npm run generate:slot-tests` if missing)

## Run

```bash
# All widgets
AUTH_METHOD=platformdb npx ts-node scripts/verify-preview-token-console.ts

# Single widget
AUTH_METHOD=platformdb npx ts-node scripts/verify-preview-token-console.ts --widget accordion

# Reuse a deploy URL
AUTH_METHOD=platformdb npx ts-node scripts/verify-preview-token-console.ts --preview-url https://stage-platform.wavemaker.ai/run-xxxxx/Project_master

# Local RN preview
npx ts-node scripts/verify-preview-token-console.ts --local-url http://localhost:19009 --widget button
```

## What It Does

1. Loads generated token-slot test cases from `.test-cache/slot-test-cases.json`
2. Logs in and deploys preview (or uses `--preview-url` / `--local-url`)
3. Opens one preview page per widget
4. For each test case, builds the same `wm.App...` command used by preview token validation
5. Evaluates the command in the browser console via `evaluatePreviewConsoleCommand`
6. Fails when output is empty, `{}`, `[]`, or a console error

## Reports

| File | Purpose |
|------|---------|
| `artifacts/preview-console-validation/preview-console-report.html` | Per-widget failure tables and summary |
| `artifacts/preview-console-validation/preview-console-report.txt` | Plain-text failure list |
| `artifacts/preview-console-validation/preview-console-report.json` | Machine-readable results |

Open the HTML report in a browser. Use the widget filter to show only widgets with failures.

## Fix Workflow

1. Open `preview-console-report.html`
2. For each failed row, inspect `mapped path`, `output`, and `console command`
3. Update `wdio/utils/mobileMapper.ts`
4. Re-run the script for the affected widget(s)

## Related Skills

- `verify-rn-style-mapping` — trace-based mapping audit against saved or live styles objects
- `compare-rn-styles` — remote vs local style object comparison
