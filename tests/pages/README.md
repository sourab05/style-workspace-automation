# Page Object Model Documentation

This directory contains Page Object Model (POM) classes for the Style Workspace Automation test suite.

## Overview

The Page Object Model is a design pattern that creates an object repository for web UI elements. It helps make tests more maintainable, readable, and reduces code duplication.

## Structure

```
tests/
├── pages/                      # Page Object classes
│   ├── TokenHelper.page.ts    # Token operations
│   ├── WidgetPage.page.ts     # Widget interactions
│   └── README.md              # This file
├── screens/                    # Screen-level page objects
│   ├── studio.screen.ts       # Studio UI operations
│   └── style.screen.ts        # Style UI operations
└── *.spec.ts                  # Test specifications
```

## Page Objects

### TokenHelper (`TokenHelper.page.ts`)

Handles all token-related operations:

- **Token Property Path Inference**: Maps token references to CSS properties
- **Token Mapping Building**: Creates mappings from token files
- **Token Reference Extraction**: Extracts references from token data
- **Payload Generation**: Builds nested payloads for API calls

**Usage Example:**
```typescript
const tokenHelper = new TokenHelper();
const propertyPath = tokenHelper.getPropertyPath('{color.primary.@.value}');
const payload = tokenHelper.buildNestedPayload(propertyPath, tokenRef);
```

**Key Methods:**
- `inferPropertyPath(tokenRef: string): string[]` - Infers CSS property for token
- `buildTokenPropertyMapping(): Record<string, string[]>` - Builds complete mapping
- `buildTokenReferences(obj: any): string[]` - Extracts all token references
- `buildNestedPayload(path: string[], ref: string): any` - Creates API payload
- `getPropertyPath(tokenRef: string): string[]` - Gets CSS property path

### WidgetPage (`WidgetPage.page.ts`)

Handles widget-specific operations:

- **Element Location**: Finds widgets in canvas and preview views
- **CSS Verification**: Validates CSS properties
- **Widget Validation**: Ensures widgets are visible and styled correctly

**Usage Example:**
```typescript
const widgetPage = new WidgetPage(page);
await widgetPage.verifyCanvasWidgetVisible('button-filled-primary-default');
await widgetPage.verifyCanvasWidgetCssProperty(
  'button-filled-primary-default',
  'background',
  '#007bff'
);
```

**Key Methods:**
- `locateCanvasWidget(snapshotName: string)` - Locates canvas widget
- `locatePreviewWidget(snapshotName: string)` - Locates preview widget
- `verifyCanvasWidgetVisible(snapshotName: string)` - Verifies canvas visibility
- `verifyPreviewWidgetVisible(snapshotName: string)` - Verifies preview visibility
- `getCanvasWidgetCssProperty(snapshotName, cssProperty)` - Gets CSS value
- `verifyCanvasWidgetCssProperty(snapshotName, cssProperty, expectedValue)` - Verifies CSS
- `extractExpectedValue(tokenFile, cssProperty)` - Extracts expected value from tokens

## Screen Objects

### StudioScreen (`screens/studio.screen.ts`)

Handles Studio UI operations:
- Login functionality
- Base screenshot capture
- Canvas and preview navigation

### StyleScreen (`screens/style.screen.ts`)

Handles Style system operations:
- Component updates via API
- Publishing and building
- Canvas/preview verification
- CSS metrics capture

## Test Structure

Tests should follow this pattern:

```typescript
import { test } from '@playwright/test';
import StudioScreen from './screens/studio.screen';
import StyleScreen from './screens/style.screen';
import { TokenHelper } from './pages/TokenHelper.page';
import { WidgetPage } from './pages/WidgetPage.page';

test.describe('Feature Tests', () => {
  const studioScreen = new StudioScreen();
  const styleScreen = new StyleScreen();
  const tokenHelper = new TokenHelper();

  test('test case', async ({ page }) => {
    const widgetPage = new WidgetPage(page);
    
    // Use page objects for all interactions
    const propertyPath = tokenHelper.getPropertyPath(tokenRef);
    const payload = tokenHelper.buildNestedPayload(propertyPath, tokenRef);
    
    await styleScreen.updateComponentAndPublish('button', payload);
    await widgetPage.verifyCanvasWidgetCssProperty(name, prop, value);
  });
});
```

## Benefits of POM

1. **Maintainability**: Changes to UI only require updates in page objects
2. **Reusability**: Page object methods can be used across multiple tests
3. **Readability**: Tests read like user actions rather than technical details
4. **Separation of Concerns**: Test logic separate from implementation details
5. **Reduced Duplication**: Common operations centralized in page objects

## Best Practices

1. **One Page Object per Logical Page/Component**
   - TokenHelper for token operations
   - WidgetPage for widget interactions
   - StudioScreen for Studio UI
   - StyleScreen for Style operations

2. **Method Naming**
   - Use descriptive names: `verifyCanvasWidgetVisible` not `checkWidget`
   - Prefix with action: `get`, `verify`, `locate`, `build`

3. **Keep Page Objects Focused**
   - Each page object should handle one area of concern
   - Don't mix token logic with widget interactions

4. **Return Values**
   - Getters should return values
   - Verify methods should use assertions
   - Helper methods should return data structures

5. **Documentation**
   - Document each page object's purpose
   - Include usage examples for complex methods
   - Document parameters and return types

## Migration from Old Pattern

**Before (inline helpers):**
```typescript
const xpath = widgetXPaths.canvas[snapshotName];
const element = page.locator(xpath);
await expect(element).toBeVisible();
const cssValue = await element.evaluate(...);
```

**After (POM):**
```typescript
const widgetPage = new WidgetPage(page);
await widgetPage.verifyCanvasWidgetCssProperty(snapshotName, cssProperty, expectedValue);
```

## Adding New Page Objects

When adding new page objects:

1. Create file in `tests/pages/` with `.page.ts` suffix
2. Export as a class
3. Document the class purpose and methods
4. Add usage examples in comments
5. Update this README

## Future Enhancements

Potential improvements:
- Add page object for matrix generation
- Create page object for test data management
- Add page object for reporting operations
- Implement page object factory pattern
