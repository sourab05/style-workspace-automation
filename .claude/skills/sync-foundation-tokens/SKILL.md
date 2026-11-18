---
name: sync-foundation-tokens
description: Keep this repo's tokens/ mirror in sync with src/tokens from the wavemaker-foundation-css GitLab repo, on demand or via cron. Use when tokens may be stale, before deriving token slots, when the user asks to pull the latest design tokens, to set up or troubleshoot the token sync cron job, or when a derivation result looks suspicious and the token source needs confirming.
---

# Sync Foundation Tokens

Replaces this repo's `tokens/` mirror with the latest `src/tokens/` from
`wavemaker-foundation-css`, so every downstream derivation reads current data.

Backing script: `scripts/sync-foundation-tokens.ts`
Cron wrapper: `scripts/cron-sync-foundation-tokens.sh`

---

## Why this matters more than it looks

`tokens/` is a **mirror**, and a stale mirror silently corrupts every conclusion drawn from it.
Measured on a full 50-widget derivation selftest:

| Token source | Widgets matching the registry | Spurious "new" slots |
|---|---|---|
| stale `tokens/` mirror | 16 | 105 |
| latest foundation-css | 31 | 49 |

Read against the stale mirror, a *correct* registry looks broken — the stale `label.json` was missing
`background-color`, `border`, `line-height` and `letter-spacing`, so the registry appeared to have
invented them. Any "the framework is out of sync" finding produced from an unsynced mirror should be
discarded and re-derived.

---

## IMPORTANT: Agent rules

- **Check the sync state before trusting any derivation.** If
  `reports/framework-delta.json` has `tokenSourceIsStaleMirror: true`, re-sync and re-derive before
  acting on it.
- **Never auto-commit without being asked.** `--commit` is opt-in. Replacing `tokens/` produces a large
  diff that should normally be reviewed.
- **`--check` is the safe cron default.** It detects drift and writes a signal file; it changes nothing.
- **The cron does not invoke the AI agent.** Automated triggering is a deferred decision
  ([architecture §6](../../../docs/09-AI-WORKFLOW-ARCHITECTURE.md#6-trigger-surfaces)). The signal file
  is the handoff point.
- **Run in the user's terminal, not a sandbox.** Needs network access to `gitlab.wavemaker.com`.

---

## Configuration

Add to `.env`:

```
GITLAB_TOKEN=glpat-xxxxxxxxxxxx           # scopes: read_api, read_repository
GITLAB_HOST=https://gitlab.wavemaker.com  # optional, this is the default
FOUNDATION_CSS_PROJECT=wm-eng/wavemaker-foundation-css
FOUNDATION_CSS_REF=stage-ai               # branch/tag/sha to track
```

Create the token at `https://gitlab.wavemaker.com/-/user_settings/personal_access_tokens`.

Optionally also set `FOUNDATION_CSS_ROOT=/path/to/wavemaker-foundation-css` if you keep a local
checkout — `derive-token-slots.ts` will then read it directly and the mirror stops mattering.

---

## Commands

```bash
# Is the mirror behind? Changes nothing. Exit 0 = up to date, 10 = behind.
npx ts-node scripts/sync-foundation-tokens.ts --check

# Replace tokens/ with the latest
npx ts-node scripts/sync-foundation-tokens.ts --apply

# Replace and commit
npx ts-node scripts/sync-foundation-tokens.ts --apply --commit

# Preview only
npx ts-node scripts/sync-foundation-tokens.ts --apply --dry-run

# A different branch/tag, or machine-readable output
npx ts-node scripts/sync-foundation-tokens.ts --check --ref main
npx ts-node scripts/sync-foundation-tokens.ts --check --json
```

Exit codes: `0` up to date or applied, `10` behind (`--check` only), `1` error, `2` no mode given.

---

## Cron setup

```bash
crontab -e
```

```cron
# Detect drift every 15 minutes (safe: reports only)
*/15 * * * * /Users/<you>/Documents/Style-Workspace-Automation/scripts/cron-sync-foundation-tokens.sh

# Or auto-replace tokens/ on every upstream change
*/15 * * * * SYNC_MODE=apply /Users/<you>/Documents/Style-Workspace-Automation/scripts/cron-sync-foundation-tokens.sh

# Or auto-replace and commit
0 * * * * SYNC_MODE=commit /Users/<you>/Documents/Style-Workspace-Automation/scripts/cron-sync-foundation-tokens.sh
```

The wrapper exists because **cron runs with a minimal environment** — no nvm, no PATH to node, no `.env`
loaded. A crontab line calling `npx ts-node` directly fails with `node: command not found`. The wrapper
sets PATH, sources nvm, takes a single-instance lock so a slow sync cannot overlap the next tick, and
rotates its log at 5 MB.

Logs: `log/foundation-token-sync.log`.

### macOS caveat

Under macOS the cron process needs Full Disk Access to read files in `~/Documents`:
System Settings → Privacy & Security → Full Disk Access → add `/usr/sbin/cron`. Without it the job
fails with permission errors. `launchd` is the supported alternative if cron proves unreliable.

Verify the job works before trusting it:

```bash
SYNC_MODE=check ./scripts/cron-sync-foundation-tokens.sh; echo "exit=$?"
tail -30 log/foundation-token-sync.log
```

---

## Artifacts

| Path | Meaning |
|------|---------|
| `.test-cache/foundation-tokens-sync.json` | Last synced upstream SHA, title, file count |
| `.test-cache/foundation-tokens-changed.json` | Written by `--check` when behind: upstream SHA, commit title, changed file list. Removed on a successful `--apply` |
| `tokens.backup-<timestamp>/` | Previous `tokens/` kept for one cycle. Prune periodically |
| `log/foundation-token-sync.log` | Cron log, rotated at 5 MB |

---

## Safety properties

1. **Download-then-replace.** `tokens/` is only touched after a successful download, so a network
   failure can never leave the repo without a tokens directory.
2. **Backup before replace.** The previous copy is renamed, not deleted.
3. **Content diff, not just SHA.** A matching upstream SHA is not treated as proof the mirror is intact —
   files may have been hand-edited — so `--check` always compares content (~150 JSON files, cheap).
4. **Single-instance lock.** Overlapping cron ticks are skipped, not queued.

---

## After a sync that changed something

Token content changed, so re-derive rather than assuming previous results still hold:

```bash
npx ts-node scripts/derive-token-slots.ts --diff
npx ts-node scripts/classify-framework-impact.ts
```

Then hand to the `test-with-ai` master skill, which decides what to repair and retest.

---

## Repo layout being mirrored

```
wavemaker-foundation-css/
  src/tokens/{web,mobile}/components/<c>/<c>.json    ← Component.json (token slots)
  src/tokens/{web,mobile}/global/                    ← global token values
  src/styles/{web,mobile}/components/<c>.less        ← Component.less
```

Only `src/tokens/` is mirrored into `tokens/`. The `.less` files are **not currently consumed** by this
framework — but that is a missed opportunity, not evidence they are unnecessary. See
[gap #13](../../../docs/10-AUTOMATION-GAPS.md).

The division:

| Source | Carries |
|--------|---------|
| `src/tokens/**/components/*.json` | **which** token slots exist |
| `src/styles/mobile/components/**.less` | **where** each slot lands (RN style path) |
| `src/styles/mobile/studio/**.less` | canvas sub-element classes (design-time) |

The framework gets the second fact today by deploying and reading `__trace` from live RN styles, when
it is sitting statically in the `.less`. If `.less` consumption is ever added, extend the sync to mirror
`src/styles/` too.
