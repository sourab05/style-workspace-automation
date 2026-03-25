const fs = require('fs');
const path = require('path');

const specsDir = path.join(process.cwd(), 'wdio', 'specs');
const files = fs
  .readdirSync(specsDir)
  .filter((name) => name.startsWith('mobile.') && name.endsWith('.token.validate.spec.ts'));

let updated = 0;

for (const file of files) {
  const filePath = path.join(specsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;

  // Align iOS baseline name with Android page baseline
  content = content.replace(/,\s*studioWidgetName,\s*propertyPath/g, `, \`${'${widgetKey}'}-page\`, propertyPath`);

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    updated += 1;
  }
}

console.log(`Updated ${updated} files.`);
