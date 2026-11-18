---
name: style-workspace-scraper
description: Scrape token slots, variants, and states from the WaveMaker Style Workspace UI using Playwright. Use when the user wants to scrape widget configurations, update widget-token-slots.json, discover new variants/states, or compare scraped data against the source of truth.
---

# Style Workspace Token Slots Scraper

## Overview

A Playwright-based scraper that extracts token slot definitions, variant configurations, and state options from the WaveMaker Studio Style Workspace. The scraped data feeds into the automation framework's `WIDGET_CONFIG` and `widget-token-slots.json`.

## Commands

```bash
# Scrape all configured widgets
npm run scrape:slots

# Scrape specific widgets
npm run scrape:slots -- --widgets button,popover,accordion

# Explore a single widget (screenshots + DOM dump for debugging)
npm run scrape:slots -- --explore popover

# Compare scraped data against source of truth
npm run scrape:slots -- --diff
# or
npm run scrape:slots:diff

# Approve and merge scraped data into source of truth
npm run scrape:slots:approve
```

## Workflow

1. **Scrape** — runs `scripts/scrape-token-slots.ts`, outputs to `reports/scraped-token-slots.json`
2. **Review** — inspect the JSON, check `discoveredConfig` for variant/state accuracy
3. **Diff** — compare scraped data vs `wdio/config/widget-token-slots.json` and `WIDGET_CONFIG` (also writes `reports/new-token-slots.json` for incremental RN mapping)
4. **Approve** — merge token slots into `wdio/config/widget-token-slots.json`
5. **RN mappings** — use `verify-rn-style-mapping` skill with `--new-slots-only` to add `mobileMapper.ts` entries for new properties only

### IMPORTANT: Agent rules

- **Always use graphify before grep.** When searching for code context, first run `graphify query "<question>"` or `graphify explain "<concept>"`. Only fall back to Grep if graphify returns no results.
- **Always run commands in the user's terminal, NOT in the sandbox.** All scripts in this project require network access to WaveMaker Studio domains. The Cursor sandbox blocks these requests. When running any command from this skill, use `required_permissions: ["all"]` in the Shell tool call to bypass the sandbox, or provide the command to the user to run manually.
- **NEVER run `scrape:slots:approve` without explicit user confirmation.** Always show the diff report first and ask the user before merging into the source of truth.
- **Always use a fresh deploy** when running RN mapping verification — never reuse a cached preview URL.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/scrape-token-slots.ts` | Main scraper script |
| `reports/scraped-token-slots.json` | Scraped output (temporary) |
| `reports/new-token-slots.json` | Added properties only (from `--diff`; input for `verify-rn-mappings --new-slots-only`) |
| `wdio/config/widget-token-slots.json` | Source of truth for token slots |
| `src/matrix/widgets.ts` | `WIDGET_CONFIG` — appearances, variants, states, allowed token types |
| `.env` | `BASE_URL`, `PROJECT_ID`, Google OAuth credentials |

## Output Format

```json
{
  "button": {
    "tokenSlots": [
      { "tokenType": "color", "properties": ["background", "border.color", "color"] },
      { "tokenType": "font", "properties": ["font-family", "font-size"] }
    ],
    "variantSlots": {
      "icon:standard": [...]
    },
    "discoveredConfig": {
      "appearances": ["filled", "outlined", "text"],
      "variants": { "filled": ["default", "primary", "secondary"] },
      "states": ["default", "disabled", "hover"]
    }
  }
}
```

- `tokenSlots` — baseline slots from the first variant
- `variantSlots` — only variants with DIFFERENT slots than the baseline
- `discoveredConfig` — appearances, variants, states discovered from UI (for updating `WIDGET_CONFIG`)

## DOM Selectors (Style Workspace)

### Variant Dropdown

The Variant dropdown is a custom `<wms-typeahead>` using ng-bootstrap:

```
wms-typeahead[name="varaint-options-list"]  (note: "varaint" is a typo in the actual DOM)
  └─ input.typeahead-input                  (click to open dropdown)
     aria-owns="ngb-typeahead-0"            (points to the dropdown window)
```

The dropdown renders OUTSIDE the typeahead, as a separate element:

```
typeahead-container#ngb-typeahead-0
  └─ ul.wms-typeahead-dropdown.variant-dropdown
       └─ li.uib-typeahead-match
            ├─ div.typeahead-group-header    → appearance name (e.g. "filled")
            └─ a > span[title]              → variant name (e.g. "primary")
```

The dropdown is scrollable — must scroll `<ul>` to load all groups.

### State Dropdown

Standard `<select>` element, only populated after a variant is selected:

```
select.variant-state > option
```

### Token Slots Panel

```
div.widget-tokens-panel
  └─ div.token-parent-container
       └─ div.category-list                 (scrollable container)
            └─ div.styleConfigCard           (section: COLOR, SIZE, TEXT, STYLE)
                 ├─ label.config-card-header  (section name)
                 └─ div.tokens-list
                      └─ div.token-item
                           ├─ .token-name span           (property name)
                           └─ input.typeahead-input       (applied token value)
                              or input.token-input        (raw value)
```

The category-list panel is scrollable — use `scrollTokenPanel()` to load all sections.

## Token Type Classification

Properties are classified into framework token types using the **applied token value** prefix:

| Token prefix | Framework type |
|-------------|---------------|
| `color.*` | `color` |
| `space.*` | `space` |
| `font.*` | `font` |
| `icon.*` | `icon` |
| `border-width.*` | `border-width` |
| `border-style.*` | `border-style` |
| `border-radius.*` | `border-radius` |
| `elevation.*` | `elevation` |

Fallback: if no token value, classify by property name patterns and UI section name.

## Adding New Widgets

1. Add the widget name to the `Widget` type union in `src/matrix/widgets.ts`
2. Add a `WIDGET_CONFIG` entry with default `appearances`, `variants`, `states`, `allowedTokenTypes`
3. Add a `WIDGET_STRUCTURE_MAP` entry (usually `direct-mapping`)
4. If the URL slug differs from the config key, add to `WIDGET_URL_SLUG` in the scraper (e.g., `formcontrols` → `form-controls`)
5. Run the scraper to discover actual variants/states and token slots

## Troubleshooting

- **"No token slots found"** — the right panel didn't load; check the variant URL is valid
- **Sidebar content scraped instead of tokens** — wrong variant param; the token panel only loads after selecting a valid variant
- **Dropdown returns empty** — ensure `aria-owns` lookup finds `typeahead-container` (not `ngb-typeahead-window`)
- **Scrolling doesn't work** — the `.category-list` ancestor chain must be walked to find the scrollable element
- **Authentication fails** — delete `cache/google-browser-profile/` and re-run (will prompt for Google login)
