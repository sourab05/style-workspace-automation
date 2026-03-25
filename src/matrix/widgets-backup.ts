export type Widget =
  | 'button'
  | 'accordion'
  | 'label'
  | 'panel'
  | 'cards'
  | 'formcontrols'
  | 'form-wrapper'
  | 'navbar'
  | 'picture'
  | 'carousel'
  | 'tabbar'
  | 'bottomsheet'
  | 'barcodescanner'
  | 'tabs'
  | 'list'
  | 'chips'
  | 'radioset'
  | 'checkbox'
  | 'checkboxset'
  | 'toggle'
  | 'switch'
  | 'wizard'
  | 'container'
  | 'tile'
  | 'button-group'
  | 'anchor'
  | 'webview'
  | 'spinner'
  | 'search'
  | 'progress-bar'
  | 'progress-circle'
  | 'dropdown-menu'
  | 'popover'
  | 'login'
  | 'calendar'
  | 'slider'
  | 'rating'
  | 'icon'
  | 'lottie'
  | 'audio'
  | 'message'
  | 'modal-dialog'
  | 'fileupload'
  | 'camera'
  | 'currency'
  | 'datetime'
  // | 'grid-layout'
  | 'select'
  // | 'left-nav'
  // | 'nav-item'
  // | 'page-content'
  | 'panel-footer'
  | 'video';
export type Appearance = 'filled' | 'outlined' | 'text' | 'fab' | 'icon' | 'standard' | 'default' | 'test' | 'elevated' | 'label' | 'currency' | 'date' | 'number' | 'thumbnail';
export type Variant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'default'
  | 'standard'
  | 'danger'
  | '2x'
  | '5x'

  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'media-heading' | 'p' | 'muted' | 'standard' | 'circle' | 'rounded';

export type State = 'default' | 'disabled' | 'hover' | 'focused' | 'active' | 'current' | 'checked' | 'on' | 'selected';
export type TokenType =
  | 'color'
  | 'font'
  | 'border'
  | 'border-width'
  | 'border-style'
  | 'border-radius'
  | 'margin'
  | 'gap'
  | 'space'
  | 'spacer'
  | 'elevation'
  | 'box-shadow'
  | 'opacity'
  | 'icon'
  | 'asterisk-color'
  | 'padding';


export interface WidgetConfig {
  appearances: Appearance[];
  // Variants are only required for the appearances actually used by this widget
  variants: Partial<Record<Appearance, Variant[]>>;

  states: State[];
  allowedTokenTypes: TokenType[];
}

export const WIDGET_CONFIG: Record<Widget, WidgetConfig> = {
  button: {
    appearances: ['filled', 'outlined', 'text', 'elevated'],
    variants: {
      filled: ['primary'],
   
      
    },
    states: ['default', 'disabled'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'font',
      'gap', 'icon', 'space', 'opacity'
    ]
  },
  accordion: {
    appearances: ['standard',],
    variants: {
      standard: ['standard'],

    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'color', 'font', 'space',
    ]
  },
  label: {
    appearances: ['default', 'text', 'label'],
    variants: {
      default: ['h1'],
     

    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'margin', 'space'
    ]
  },
  panel: {
    appearances: ['default'],
    variants: {
      default: ['primary', 'secondary']
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'elevation', 'font', 'space',
    ]
  },
  cards: {
    appearances: ['default',],
    variants: {
      default: ['standard'],

    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'space'
    ]
  },
  formcontrols: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'focused', 'disabled'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'font', 'space'
    ]
  },
  'form-wrapper': {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'margin', 'space'
    ]
  },
  navbar: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'color', 'font', 'icon', 'space'
    ]
  },
  picture: {
    appearances: ['default', 'thumbnail'],
    variants: {
      default: ['circle', 'rounded'],
      thumbnail: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'space'
    ]
  },
  carousel: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'active'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'margin', 'space'
    ]
  },
  tabbar: {
    appearances: ['standard',],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'active'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'font',
      'margin', 'space'
    ]
  },
  bottomsheet: {
    appearances: ['standard',],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'space'
    ]
  },
  barcodescanner: {
    appearances: ['standard',],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'icon', 'space'
    ]
  },
  tabs: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'active'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'space'
    ]
  },
  list: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'space'
    ]
  },
  chips: {
    appearances: ['filled', 'elevated'],
    variants: {
      filled: ['primary'],
      elevated: ['standard'],
    },
    states: ['default', 'disabled', 'active'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'font',
      'gap', 'icon', 'space'
    ]
  },
  radioset: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'checked', 'disabled'],
    allowedTokenTypes: [
      'border-width', 'color', 'font', 'gap', 'icon', 'space'
    ]
  },
  checkbox: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'checked', 'disabled'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'font', 'icon', 'margin', 'space'
    ]
  },
  checkboxset: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'checked', 'disabled'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'font', 'icon', 'margin', 'space'
    ]
  },
  toggle: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'on', 'disabled'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'margin', 'space'
    ]
  },
  switch: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'selected', 'disabled'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'font', 'space'
    ]
  },
  wizard: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'current', 'active'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'font',
      'gap', 'icon', 'space'
    ]
  },
  container: {
    appearances: ['default', 'outlined', 'elevated'],
    variants: {
      default: ['standard'],
      outlined: ['standard'],
      elevated: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'space'
    ]
  },
  tile: {
    appearances: ['default', 'filled'],
    variants: {
      default: ['primary'],
      filled: ['danger'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'space'
    ]
  },
  'button-group': {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color'
    ]
  },
  anchor: {
    appearances: ['standard', 'default'],
    variants: {
      standard: ['standard']
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'color', 'font', 'gap', 'icon', 'space'
    ]
  },
  webview: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'space'
    ]
  },
  spinner: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'color', 'font', 'icon', 'space'
    ]
  },
  search: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-width', 'color', 'font', 'icon', 'margin', 'space'
    ]
  },
  'progress-bar': {
    appearances: ['filled'],
    variants: {
      filled: ['default', 'info', 'success', 'warning', 'danger'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'color', 'font', 'margin', 'space'
    ]
  },
  'progress-circle': {
    appearances: ['filled'],
    variants: {
      filled: ['default', 'info', 'success', 'warning', 'danger'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'color', 'font', 'space'
    ]
  },
  'dropdown-menu': {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'icon', 'space'
    ]
  },
  popover: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'font', 'icon', 'space'
    ]
  },
  login: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'color', 'space'
    ]
  },
  calendar: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'elevation', 'font',
      'gap', 'margin', 'space'
    ]
  },
  slider: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'color', 'margin', 'space'
    ]
  },
  rating: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default', 'disabled', 'active'],
    allowedTokenTypes: [
      'color', 'font', 'icon', 'opacity', 'space'
    ]
  },
  icon: {
    appearances: ['default'],
    variants: {
      default: ['2x', '5x'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'color', 'font', 'gap', 'space'
    ]
  },
  lottie: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'space'
    ]
  },
  audio: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'space'
    ]
  },
  message: {
    appearances: ['filled'],
    variants: {
      filled: ['error', 'success'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'icon', 'space'
    ]
  },
  'modal-dialog': {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'font', 'icon', 'space'
    ]
  },
  fileupload: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: [
      'border-radius', 'border-style', 'border-width', 'color', 'space', 'font', 'icon'
    ]
  },
  camera: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: ['border-radius', 'border-width', 'color', 'space']
  },
  currency: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: ['color', 'font', 'space']
  },
  datetime: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: ['border-radius', 'border-style', 'border-width', 'color', 'font']
  },
  // 'grid-layout': {
  //   appearances: ['standard'],
  //   variants: {
  //     standard: ['standard'],
  //   },
  //   states: ['default'],
  //   allowedTokenTypes: []
  // },
  select: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: ['border-radius', 'border-style', 'border-width', 'color', 'font', 'icon', 'space']
  },
  // 'left-nav': {
  //   appearances: ['standard'],
  //   variants: {
  //     standard: ['standard'],
  //   },
  //   states: ['default'],
  //   allowedTokenTypes: []
  // },
  // 'nav-item': {
  //   appearances: ['standard'],
  //   variants: {
  //     standard: ['standard'],
  //   },
  //   states: ['default'],
  //   allowedTokenTypes: []
  // },
  // 'page-content': {
  //   appearances: ['standard'],
  //   variants: {
  //     standard: ['standard'],
  //   },
  //   states: ['default'],
  //   allowedTokenTypes: []
  // },
  'panel-footer': {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: ['border-radius', 'border-style', 'border-width', 'color', 'space']
  },
  video: {
    appearances: ['standard'],
    variants: {
      standard: ['standard'],
    },
    states: ['default'],
    allowedTokenTypes: ['space']
  },
};

export interface MatrixItem {
  widget: Widget;
  appearance: Appearance;
  variant: Variant;
  state: State;
  tokenType: TokenType;
}

/**
 * Widget structure types for determining payload format
 */
export type WidgetStructureType = 'standard-appearance' | 'standard-variant' | 'hybrid-mapping' | 'appearance-mapping' | 'direct-mapping';

export const WIDGET_STRUCTURE_MAP: Record<string, WidgetStructureType> = {
  'button': 'standard-variant',
  'accordion': 'direct-mapping',
  'label': 'standard-variant',
  'panel': 'standard-variant',
  'cards': 'appearance-mapping',
  'formcontrols': 'hybrid-mapping',
  'form-wrapper': 'direct-mapping',
  'navbar': 'direct-mapping',
  'picture': 'standard-variant',
  'carousel': 'hybrid-mapping',
  'tabbar': 'hybrid-mapping',
  'bottomsheet': 'direct-mapping',
  'barcodescanner': 'direct-mapping',
  'tabs': 'hybrid-mapping',
  'list': 'direct-mapping',
  'wizard': 'direct-mapping',
  'container': 'appearance-mapping',
  'tile': 'standard-variant',
  'button-group': 'direct-mapping',
  'anchor': 'direct-mapping',
  'webview': 'direct-mapping',
  'spinner': 'direct-mapping',
  'search': 'direct-mapping',
  'progress-bar': 'standard-variant',
  'progress-circle': 'standard-variant',
  'dropdown-menu': 'direct-mapping',
  'popover': 'direct-mapping',
  'login': 'direct-mapping',
  'calendar': 'direct-mapping',
  'slider': 'direct-mapping',
  'rating': 'direct-mapping',
  'icon': 'standard-variant',
  'lottie': 'direct-mapping',
  'audio': 'direct-mapping',
  'message': 'standard-variant',
  'modal-dialog': 'direct-mapping',
  'chips': 'hybrid-mapping',
  'radioset': 'direct-mapping',
  'checkbox': 'direct-mapping',
  'checkboxset': 'direct-mapping',
  'toggle': 'direct-mapping',
  'switch': 'direct-mapping',
  'fileupload': 'direct-mapping',
  'camera': 'direct-mapping',
  'currency': 'direct-mapping',
  'datetime': 'direct-mapping',
  // 'grid-layout': 'direct-mapping',
  'select': 'direct-mapping',
  // 'left-nav': 'direct-mapping',
  // 'nav-item': 'direct-mapping',
  // 'page-content': 'direct-mapping',
  'panel-footer': 'direct-mapping',
  'video': 'direct-mapping',
};

export function getWidgetStructureType(widget: string): WidgetStructureType {
  return WIDGET_STRUCTURE_MAP[widget] || 'standard-appearance';
}
