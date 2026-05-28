/**
 * Normalize studio widget instance id for RN `Widgets…` paths.
 * Strips accidental outer `[…]` / quotes so `[panel-footer1]` does not become `['[panel-footer1]']`.
 */
export function normalizeStudioWidgetInstanceKey(studioWidgetName: string): string {
  let key = studioWidgetName.trim();
  for (let i = 0; i < 4; i++) {
    if (key.startsWith('[') && key.endsWith(']')) {
      key = key.slice(1, -1).trim();
      continue;
    }
    if (
      (key.startsWith("'") && key.endsWith("'")) ||
      (key.startsWith('"') && key.endsWith('"'))
    ) {
      key = key.slice(1, -1).trim();
      continue;
    }
    break;
  }
  return key;
}

export function studioWidgetsPropertyAccess(studioWidgetName: string): string {
  const key = normalizeStudioWidgetInstanceKey(studioWidgetName);
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return `.${key}`;
  }

  const escaped = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `['${escaped}']`;
}
