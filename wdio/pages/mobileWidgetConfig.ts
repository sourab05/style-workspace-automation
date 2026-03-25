import type { Widget } from '../../src/matrix/widgets';
import { mobileWidgetSelectors } from '../../src/matrix/widget-xpaths';

/**
 * Central configuration of mobile selectors per widget and platform.
 *
 * Selectors are sourced from the shared widget matrix in
 * `src/matrix/widget-xpaths.ts` via `mobileWidgetSelectors`, which
 * defines android/ios selectors per **widget variant** (snapshotName).
 *
 * This module exposes a widget-level view (`MOBILE_WIDGET_SELECTORS`)
 * for existing POM usage, plus a helper for variant-level selectors
 * when tests need to target a specific variant on the mobile page.
 */

// Canonical variant key to represent each widget when only the widget
// name (e.g. 'button') is available. These keys must exist in
// `mobileWidgetSelectors.android` / `.ios`.
const DEFAULT_VARIANT_FOR_WIDGET: Partial<Record<Widget, string>> = {
  button: 'button-filled-primary-default',
  accordion: 'accordion-standard-standard-default',
  label: 'label-default-h1-default',
  panel: 'panel-default-primary-default',
  cards: 'cards-default-standard-default',
  formcontrols: 'formcontrols-standard-standard-default',
  'form-wrapper': 'form-wrapper-standard-standard-default',
  navbar: 'navbar-standard-standard-default',
  picture: 'picture-default-rounded-default',
  carousel: 'carousel-standard-standard-default',
  tabbar: 'tabbar-standard-standard-default',
  bottomsheet: 'bottomsheet-standard-standard-default',
  barcodescanner: 'barcodescanner-standard-standard-default',
  tabs: 'tabs-standard-standard-default',
  list: 'list-standard-standard-default',
  chips: 'chips-filled-primary-default',
  radioset: 'radioset-standard-standard-default',
  checkbox: 'checkbox-standard-standard-default',
  checkboxset: 'checkboxset-standard-standard-default',
  toggle: 'toggle-standard-standard-default',
  switch: 'switch-standard-standard-default',
  wizard: 'wizard-standard-standard-default',
  container: 'container-default-standard-default',
  tile: 'tile-default-primary-default',
  'button-group': 'button-group-standard-standard-default',
  anchor: 'anchor-standard-primary-default',
  webview: 'webview-standard-standard-default',
  spinner: 'spinner-standard-standard-default',
  search: 'search-standard-standard-default',
  'progress-bar': 'progress-bar-standard-standard-default',
  'progress-circle': 'progress-circle-standard-standard-default',
  'dropdown-menu': 'dropdown-menu-standard-standard-default',
  popover: 'popover-standard-standard-default',
  login: 'login-standard-standard-default',
  calendar: 'calendar-standard-standard-default',
  slider: 'slider-standard-standard-default',
  rating: 'rating-standard-standard-default',
  icon: 'icon-default-2x-default',
  lottie: 'lottie-standard-standard-default',
  audio: 'audio-standard-standard-default',
  message: 'message-filled-error-default',
  'modal-dialog': 'modal-standard-standard-default',
  fileupload: 'fileupload-standard-standard-default',
  currency: 'currency-standard-standard-default',
  select: 'select-standard-standard-default',
};

function resolveWidgetSelector(widget: Widget, platform: 'android' | 'ios'): string {
  const variantKey = DEFAULT_VARIANT_FOR_WIDGET[widget];
  const platformMap = mobileWidgetSelectors[platform] as Record<string, string>;
  const selector = variantKey ? platformMap[variantKey] : undefined;

  if (!selector) {
    // Fallback: try accessibility id using the widget name
    // (keeps tests from crashing if matrix is incomplete).
    console.warn(
      `No mobile selector found for widget='${widget}', variant='${variantKey}', platform='${platform}'. ` +
      `Falling back to accessibility id selector '~${widget}'.`
    );
    return `~${widget}`;
  }

  return selector;
}

/**
 * Widget-level selector map used by MobileWidgetPage when it only knows
 * the widget key (e.g. 'button'). Under the hood, this is resolved from
 * the per-variant selector matrix in `mobileWidgetSelectors`.
 */
export const MOBILE_WIDGET_SELECTORS: Partial<Record<Widget, { android: string; ios: string }>> = {
  button: {
    android: resolveWidgetSelector('button', 'android'),
    ios: resolveWidgetSelector('button', 'ios'),
  },
  accordion: {
    android: resolveWidgetSelector('accordion', 'android'),
    ios: resolveWidgetSelector('accordion', 'ios'),
  },
  label: {
    android: resolveWidgetSelector('label', 'android'),
    ios: resolveWidgetSelector('label', 'ios'),
  },
  panel: {
    android: resolveWidgetSelector('panel', 'android'),
    ios: resolveWidgetSelector('panel', 'ios'),
  },
  cards: {
    android: resolveWidgetSelector('cards', 'android'),
    ios: resolveWidgetSelector('cards', 'ios'),
  },
  formcontrols: {
    android: resolveWidgetSelector('formcontrols', 'android'),
    ios: resolveWidgetSelector('formcontrols', 'ios'),
  },
  'form-wrapper': {
    android: resolveWidgetSelector('form-wrapper', 'android'),
    ios: resolveWidgetSelector('form-wrapper', 'ios'),
  },
  navbar: {
    android: resolveWidgetSelector('navbar', 'android'),
    ios: resolveWidgetSelector('navbar', 'ios'),
  },
  picture: {
    android: resolveWidgetSelector('picture', 'android'),
    ios: resolveWidgetSelector('picture', 'ios'),
  },
  carousel: {
    android: resolveWidgetSelector('carousel', 'android'),
    ios: resolveWidgetSelector('carousel', 'ios'),
  },
  tabbar: {
    android: resolveWidgetSelector('tabbar', 'android'),
    ios: resolveWidgetSelector('tabbar', 'ios'),
  },
  bottomsheet: {
    android: resolveWidgetSelector('bottomsheet', 'android'),
    ios: resolveWidgetSelector('bottomsheet', 'ios'),
  },
  barcodescanner: {
    android: resolveWidgetSelector('barcodescanner', 'android'),
    ios: resolveWidgetSelector('barcodescanner', 'ios'),
  },
  tabs: {
    android: resolveWidgetSelector('tabs', 'android'),
    ios: resolveWidgetSelector('tabs', 'ios'),
  },
  list: {
    android: resolveWidgetSelector('list', 'android'),
    ios: resolveWidgetSelector('list', 'ios'),
  },
  chips: {
    android: resolveWidgetSelector('chips', 'android'),
    ios: resolveWidgetSelector('chips', 'ios'),
  },
  radioset: {
    android: resolveWidgetSelector('radioset', 'android'),
    ios: resolveWidgetSelector('radioset', 'ios'),
  },
  checkbox: {
    android: resolveWidgetSelector('checkbox', 'android'),
    ios: resolveWidgetSelector('checkbox', 'ios'),
  },
  checkboxset: {
    android: resolveWidgetSelector('checkboxset', 'android'),
    ios: resolveWidgetSelector('checkboxset', 'ios'),
  },
  toggle: {
    android: resolveWidgetSelector('toggle', 'android'),
    ios: resolveWidgetSelector('toggle', 'ios'),
  },
  switch: {
    android: resolveWidgetSelector('switch', 'android'),
    ios: resolveWidgetSelector('switch', 'ios'),
  },
  wizard: {
    android: resolveWidgetSelector('wizard', 'android'),
    ios: resolveWidgetSelector('wizard', 'ios'),
  },
  container: {
    android: resolveWidgetSelector('container', 'android'),
    ios: resolveWidgetSelector('container', 'ios'),
  },
  tile: {
    android: resolveWidgetSelector('tile', 'android'),
    ios: resolveWidgetSelector('tile', 'ios'),
  },
  'button-group': {
    android: resolveWidgetSelector('button-group', 'android'),
    ios: resolveWidgetSelector('button-group', 'ios'),
  },
  anchor: {
    android: resolveWidgetSelector('anchor', 'android'),
    ios: resolveWidgetSelector('anchor', 'ios'),
  },
  webview: {
    android: resolveWidgetSelector('webview', 'android'),
    ios: resolveWidgetSelector('webview', 'ios'),
  },
  spinner: {
    android: resolveWidgetSelector('spinner', 'android'),
    ios: resolveWidgetSelector('spinner', 'ios'),
  },
  search: {
    android: resolveWidgetSelector('search', 'android'),
    ios: resolveWidgetSelector('search', 'ios'),
  },
  'progress-bar': {
    android: resolveWidgetSelector('progress-bar', 'android'),
    ios: resolveWidgetSelector('progress-bar', 'ios'),
  },
  'progress-circle': {
    android: resolveWidgetSelector('progress-circle', 'android'),
    ios: resolveWidgetSelector('progress-circle', 'ios'),
  },
  'dropdown-menu': {
    android: resolveWidgetSelector('dropdown-menu', 'android'),
    ios: resolveWidgetSelector('dropdown-menu', 'ios'),
  },
  popover: {
    android: resolveWidgetSelector('popover', 'android'),
    ios: resolveWidgetSelector('popover', 'ios'),
  },
  login: {
    android: resolveWidgetSelector('login', 'android'),
    ios: resolveWidgetSelector('login', 'ios'),
  },
  calendar: {
    android: resolveWidgetSelector('calendar', 'android'),
    ios: resolveWidgetSelector('calendar', 'ios'),
  },
  slider: {
    android: resolveWidgetSelector('slider', 'android'),
    ios: resolveWidgetSelector('slider', 'ios'),
  },
  rating: {
    android: resolveWidgetSelector('rating', 'android'),
    ios: resolveWidgetSelector('rating', 'ios'),
  },
  icon: {
    android: resolveWidgetSelector('icon', 'android'),
    ios: resolveWidgetSelector('icon', 'ios'),
  },
  lottie: {
    android: resolveWidgetSelector('lottie', 'android'),
    ios: resolveWidgetSelector('lottie', 'ios'),
  },
  audio: {
    android: resolveWidgetSelector('audio', 'android'),
    ios: resolveWidgetSelector('audio', 'ios'),
  },
  message: {
    android: resolveWidgetSelector('message', 'android'),
    ios: resolveWidgetSelector('message', 'ios'),
  },
  'modal-dialog': {
    android: resolveWidgetSelector('modal-dialog', 'android'),
    ios: resolveWidgetSelector('modal-dialog', 'ios'),
  },
  fileupload: {
    android: resolveWidgetSelector('fileupload', 'android'),
    ios: resolveWidgetSelector('fileupload', 'ios'),
  },
  currency: {
    android: resolveWidgetSelector('currency', 'android'),
    ios: resolveWidgetSelector('currency', 'ios'),
  },
  select: {
    android: resolveWidgetSelector('select', 'android'),
    ios: resolveWidgetSelector('select', 'ios'),
  },
};

/**
 * Variant-level selector lookup.
 *
 * `variantName` must match the snapshotName format
 * `${widget}-${appearance}-${variant}-${state}` that we use across
 * the matrix (e.g. 'button-filled-primary-default').
 */
export function getMobileSelectorForVariant(
  variantName: string,
  platform: 'android' | 'ios',
): string | null {
  const platformMap = mobileWidgetSelectors[platform] as Record<string, string>;
  return platformMap[variantName] || null;
}
