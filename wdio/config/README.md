# Widget Token Slots Configuration

## Purpose

This file (`widget-token-slots.json`) is the **source of truth** for all token slots that should be tested for each widget. It explicitly defines which properties can accept tokens for each token type.

## Structure

```json
{
  "widget-name": {
    "tokenSlots": [
      {
        "tokenType": "color",
        "properties": ["background", "border.color", ...]
      },
      {
        "tokenType": "font",
        "properties": ["font-size", "font-weight", ...]
      }
    ]
  }
}
```

## Token Types

- `color` - Color tokens
- `font` - Typography tokens (size, weight, family, etc.)
- `icon` - Icon size tokens
- `border-radius` - Border radius tokens
- `border-width` - Border width tokens  
- `border-style` - Border style tokens
- `elevation` / `box-shadow` - Shadow/elevation tokens
- `opacity` - Opacity tokens
- `gap` - Gap tokens
- `space` / `padding` / `margin` - Spacing tokens

## Usage

### Reading Configuration

```typescript
import { WidgetTokenConfigRegistry } from '../config/widgetTokenConfig';

const config = WidgetTokenConfigRegistry.getConfig('tabbar');
console.log(config.tokenSlots);
// [
//   { tokenType: 'color', properties: ['border.top.color', ...] },
//   { tokenType: 'font', properties: ['text.font.family', ...] },
//   ...
// ]
```

### Comparing with Payload

```typescript
import { PayloadConfigComparator } from '../utils/payloadConfigComparator';

const comparison = PayloadConfigComparator.compare('tabbar', batchPayload);
console.log(comparison.coverage.coveragePercent); // e.g., 85.5%
```

## Relationship to Other Files

### This File (widget-token-slots.json)
**What**: Defines WHAT properties should be testable
**Purpose**: Source of truth for validation coverage

### mobileTokenDistributor.ts  
**What**: Defines HOW to extract those properties
**Purpose**: Implementation detail - maps property paths to RN style paths

### Workflow

```
widget-token-slots.json (WHAT to test)
         ↓
   Configuration loaded by widgetTokenConfig.ts
         ↓
   Compared against batch payload
         ↓
   Tests execute using mobileTokenDistributor.ts (HOW)
         ↓
   Results tracked and compared back to configuration
```

## Maintaining This File

### Adding a New Widget

1. Add widget entry with all token slots:
```json
"new-widget": {
  "tokenSlots": [
    { "tokenType": "color", "properties": ["background", ...] },
    { "tokenType": "font", "properties": ["font-size", ...] }
  ]
}
```

### Adding Properties to Existing Widget

1. Find the widget
2. Find the appropriate token type
3. Add property to the `properties` array

### Removing Properties

Remove from the `properties`array - this will mark them as "not configured" in comparison reports

## Validation

To ensure this file is valid:

```bash
# Check JSON syntax
cat wdio/config/widget-token-slots.json | jq .

# Export and review
ts-node -e "
import { WidgetTokenConfigRegistry } from './wdio/config/widgetTokenConfig';
console.log(WidgetTokenConfigRegistry.exportAsJson());
"
```

## Important Notes

- ⚠️ This file is **independent** of `mobileTokenDistributor.ts`
- ✅ It defines **what should be tested**, not **how to test it**
- 📊 Coverage reports compare **this file** against **batch payloads**
- 🔄 Keep this updated when adding new token properties to widgets
