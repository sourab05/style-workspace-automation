export function studioWidgetsPropertyAccess(studioWidgetName: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(studioWidgetName)) {
    return `.${studioWidgetName}`;
  }

  const escaped = studioWidgetName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `['${escaped}']`;
}
