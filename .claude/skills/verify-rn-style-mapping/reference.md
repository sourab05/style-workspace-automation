# Reference: Verify RN Style Mapping

## Data Flow

```
widget-token-slots.json     CSV files                    RN Preview (browser)
(token slots per widget)    (variant → studioWidgetName) (live styles object)
         │                         │                            │
         ▼                         ▼                            ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              verify-rn-mappings.ts                           │
  │  1. Read token slots for each widget                        │
  │  2. Look up studioWidgetName from CSV                       │
  │  3. Open RN preview page in browser                         │
  │  4. Execute: wm.App...Widgets.{name}._INSTANCE.styles       │
  │  5. For each token property:                                │
  │     - Run MobileMapper.mapToRnStylePath(prop, widget)       │
  │     - Check if mapped path exists in fetched styles object  │
  │  6. Output report: valid / invalid / unmapped               │
  └──────────────────────────────────────────────────────────────┘
         │
         ▼
  artifacts/rn-styles/
    ├── {widget}.styles.json       (raw styles from each widget)
    ├── mapping-report.json        (structured results)
    └── mapping-report.txt         (human-readable summary)
```

## Browser Console Command

In the RN web preview, the global `wm` object exposes the app runtime. The style command format:

```javascript
// Standard:
wm.App.appConfig.currentPage.Widgets.{studioWidgetName}._INSTANCE.styles

// Cards (nested list widget):
wm.App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.calcStyles

// FormControls (nested form widget):
wm.App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.entestkey.calcStyles
```

## Styles Object Structure Example (button)

```json
{
  "root": {
    "backgroundColor": "#6200ee",
    "borderRadius": 4,
    "borderWidth": 0,
    "minHeight": 36,
    "paddingLeft": 16,
    "paddingRight": 16,
    "opacity": 1
  },
  "text": {
    "color": "#ffffff",
    "fontSize": 14,
    "fontWeight": "500",
    "fontFamily": "Roboto",
    "letterSpacing": 1.25
  },
  "icon": {
    "icon": {
      "width": 18,
      "height": 18,
      "color": "#ffffff"
    }
  },
  "skeleton": {
    "root": { "width": 120 }
  }
}
```

## MobileMapper.mapToRnStylePath Examples

| Widget | Property Path | Mapped RN Path |
|--------|--------------|---------------|
| button | `['background']` | `root.backgroundColor` |
| button | `['color']` | `text.color` |
| button | `['border','color']` | `root.borderColor` |
| accordion | `['header','background-color']` | `header.backgroundColor` |
| accordion | `['badge','border','width']` | `badge.borderWidth` |
| panel | `['heading','icon','color']` | `icon.text.color` |
| chips | `['item','icon','color']` | `clearIcon.root.color` |
| radioset | `['indicator','size']` | `checkedRadio.icon.fontSize` |

## CSV File Format

Each widget has a CSV at `tests/testdata/mobile/{widget}-widget-variants.csv`:

```csv
variantName,studioWidgetName
button-filled-primary-default,button1
button-filled-primary-disabled,button2
```

The script uses the **first data row** to pick a representative studioWidgetName for fetching the styles object.

## After Review: How to Update mobileMapper.ts

Once the report identifies invalid or unmapped paths:

1. Open the widget's `artifacts/rn-styles/{widget}.styles.json`
2. Find the correct path by searching for the expected namespace/property
3. Update the corresponding `if` block in `wdio/utils/mobileMapper.ts`

Example fix — if `badge.border.radius` maps to `badge.borderRadius` but the styles JSON shows it under `badge.root.borderRadius`:

```typescript
// Before (wrong):
if (second === 'border' && third === 'radius') return 'badge.borderRadius';

// After (correct):
if (second === 'border' && third === 'radius') return 'badge.root.borderRadius';
```

## Running for a Single Widget

```bash
npx ts-node scripts/verify-rn-mappings.ts --widget button
npx ts-node scripts/verify-rn-mappings.ts --widget accordion --headless
```

## Running for All Widgets

```bash
npx ts-node scripts/verify-rn-mappings.ts
```
