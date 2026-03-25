/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const widgetArgs = [];
let allureDir = path.join(process.cwd(), 'allure-results');
let dryRun = false;
const statusArgs = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--widgets' || arg === '-w') {
    const raw = args[i + 1] || '';
    i += 1;
    raw.split(',').map(v => v.trim()).filter(Boolean).forEach(v => widgetArgs.push(v));
  } else if (arg === '--widget') {
    const raw = args[i + 1] || '';
    i += 1;
    if (raw) widgetArgs.push(raw);
  } else if (arg === '--allure-dir') {
    const raw = args[i + 1] || '';
    i += 1;
    if (raw) allureDir = path.resolve(raw);
  } else if (arg === '--status') {
    const raw = args[i + 1] || '';
    i += 1;
    raw.split(',').map(v => v.trim()).filter(Boolean).forEach(v => statusArgs.push(v));
  } else if (arg === '--dry-run') {
    dryRun = true;
  }
}

if (widgetArgs.length === 0 && statusArgs.length === 0) {
  console.error('Usage: node scripts/clean-allure-by-widget.js --widgets <comma,separated,list>');
  console.error('       node scripts/clean-allure-by-widget.js --status skipped');
  console.error('Example: node scripts/clean-allure-by-widget.js --widgets formcontrols,form-wrapper,progress-bar');
  process.exit(1);
}

const widgetLabelMap = {
  accordion: 'Accordion',
  anchor: 'Anchor',
  barcodescanner: 'Barcode Scanner',
  bottomsheet: 'Bottomsheet',
  'button-group': 'Button Group',
  button: 'Button',
  cards: 'Cards',
  carousel: 'Carousel',
  checkbox: 'Checkbox',
  checkboxset: 'Checkboxset',
  chips: 'Chips',
  container: 'Container',
  'dropdown-menu': 'Dropdown Menu',
  formcontrols: 'Form Controls',
  'form-wrapper': 'Form-Wrapper',
  label: 'Label',
  list: 'List',
  login: 'Login',
  navbar: 'Navbar',
  panel: 'Panel',
  picture: 'Picture',
  popover: 'Popover',
  'progress-bar': 'Progress Bar',
  'progress-circle': 'Progress Circle',
  radioset: 'Radioset',
  search: 'Search',
  spinner: 'Spinner',
  switch: 'Switch',
  tabbar: 'Tabbar',
  tabs: 'Tabs',
  tile: 'Tile',
  toggle: 'Toggle',
  webview: 'Webview',
  wizard: 'Wizard',
};

const normalizeKey = (value) => value.trim().toLowerCase();
const widgetLabels = widgetArgs.map((raw) => {
  const key = normalizeKey(raw);
  return widgetLabelMap[key] || raw;
});

const suiteRegexes = widgetLabels.map((label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexible = escaped.replace(/[- ]+/g, '[- ]+');
  return new RegExp(`Mobile Token Validation - ${flexible} Widget`, 'i');
});

const statusFilters = statusArgs.map((status) => status.toLowerCase());

if (!fs.existsSync(allureDir)) {
  console.error(`Allure results directory not found: ${allureDir}`);
  process.exit(1);
}

const files = fs.readdirSync(allureDir);
const toDelete = new Set();

for (const file of files) {
  if (!file.endsWith('.json')) continue;
  const fullPath = path.join(allureDir, file);
  let content = '';
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch {
    continue;
  }

  const suiteMatches = suiteRegexes.length === 0
    ? true
    : suiteRegexes.some((regex) => regex.test(content));

  let statusMatches = statusFilters.length === 0;
  let parsed;
  try {
    parsed = JSON.parse(content);
    if (statusFilters.length > 0) {
      const status = typeof parsed.status === 'string' ? parsed.status.toLowerCase() : '';
      statusMatches = statusFilters.includes(status);
    }
  } catch {
    if (statusFilters.length > 0) {
      statusMatches = false;
    }
  }

  if (!suiteMatches || !statusMatches) continue;

  toDelete.add(fullPath);

  try {
    const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
    for (const attachment of attachments) {
      if (attachment && attachment.source) {
        toDelete.add(path.join(allureDir, attachment.source));
      }
    }
  } catch {
    // ignore invalid JSON
  }
}

if (toDelete.size === 0) {
  const filters = [];
  if (widgetLabels.length > 0) filters.push(`widgets: ${widgetLabels.join(', ')}`);
  if (statusFilters.length > 0) filters.push(`status: ${statusFilters.join(', ')}`);
  console.log(`No matching Allure files found for ${filters.join(' | ')}`);
  process.exit(0);
}

console.log(`${dryRun ? 'Would delete' : 'Deleting'} ${toDelete.size} files from ${allureDir}`);

for (const filePath of toDelete) {
  if (!fs.existsSync(filePath)) continue;
  if (dryRun) {
    console.log(`- ${path.relative(process.cwd(), filePath)}`);
  } else {
    fs.unlinkSync(filePath);
  }
}

console.log(dryRun ? 'Dry run complete.' : 'Deletion complete.');
