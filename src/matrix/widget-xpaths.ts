export const widgetXPaths = {
  // Style Inspector selectors for Preview (RN web bundle)
  previewInspector: {
    styleCommandInput: "//input[@placeholder='Enter text']",
    styleOutputLabel: "//input[@placeholder='Enter text']/preceding-sibling::*[1]",
    widgetOverrides: {
      formcontrols: {
        styleCommandInput: "//input[@aria-label='exinput_i']",
        styleOutputLabel: "//input[@aria-label='exinput_i']/preceding-sibling::*[1]",
      },
    } as Record<string, { styleCommandInput: string; styleOutputLabel: string }>,
  },
  
  canvas: {
    // ==================== BUTTON (root + icon for icon-size, font/caption for font tokens) ====================
    'button-filled-primary-default': "//button[@name='button1']",
    'button-filled-primary-default-icon': "//button[@name='button1']//i",
    'button-filled-primary-default-font': "//button[@name='button1']//span[@class='btn-caption']",
    'button-filled-primary-disabled': "//button[@name='button2']",
    'button-filled-primary-disabled-icon': "//button[@name='button2']//i",
    'button-filled-primary-disabled-font': "//button[@name='button2']//span[@class='btn-caption']",
    'button-filled-secondary-default': "//button[@name='button3']",
    'button-filled-secondary-default-icon': "//button[@name='button3']//i",
    'button-filled-secondary-default-font': "//button[@name='button3']//span[@class='btn-caption']",
    'button-filled-secondary-disabled': "//button[@name='button4']",
    'button-filled-secondary-disabled-icon': "//button[@name='button4']//i",
    'button-filled-secondary-disabled-font': "//button[@name='button4']//span[@class='btn-caption']",
    'button-outlined-tertiary-default': "//button[@name='button5']",
    'button-outlined-tertiary-default-icon': "//button[@name='button5']//i",
    'button-outlined-tertiary-default-font': "//button[@name='button5']//span[@class='btn-caption']",
    'button-outlined-tertiary-disabled': "//button[@name='button6']",
    'button-outlined-tertiary-disabled-icon': "//button[@name='button6']//i",
    'button-outlined-tertiary-disabled-font': "//button[@name='button6']//span[@class='btn-caption']",
    'button-text-info-default': "//button[@name='button7']",
    'button-text-info-default-icon': "//button[@name='button7']//i",
    'button-text-info-default-font': "//button[@name='button7']//span[@class='btn-caption']",
    'button-text-info-disabled': "//button[@name='button8']",
    'button-text-info-disabled-icon': "//button[@name='button8']//i",
    'button-text-info-disabled-font': "//button[@name='button8']//span[@class='btn-caption']",
    'button-elevated-standard-default': "//button[@name='button9']",
    'button-elevated-standard-default-icon': "//button[@name='button9']//i",
    'button-elevated-standard-default-font': "//button[@name='button9']//span[@class='btn-caption']",
    'button-elevated-standard-disabled': "//button[@name='button10']",
    'button-elevated-standard-disabled-icon': "//button[@name='button10']//i",
    'button-elevated-standard-disabled-font': "//button[@name='button10']//span[@class='btn-caption']",

    // ==================== ACCORDION (sub-elements: badge, header, body, icon, text, title, description) ====================
    // -- standard-standard-default --
    'accordion-standard-standard-default': "//div[@name='accordion1']",
    'accordion-standard-standard-default-header': "//div[@name='accordionpane2']//div[contains(@class,'panel-heading')]",
    'accordion-standard-standard-default-body': "//div[@class='panel-collapse collapse in']//div[@class='panel-body']",
    'accordion-standard-standard-default-title': "//div[@name='accordionpane2']//div[contains(@class,'panel-heading')]//h3//div//i",
    'accordion-standard-standard-default-subtitle': "//div[@name='accordionpane1']//div[@class='description']",
    'accordion-standard-standard-default-description': "//div[@name='accordionpane1']//div[@class='description']",
    'accordion-standard-standard-default-badge': "//div[@name='accordionpane2']//div[contains(@class,'panel-heading')]//div[contains(@class,'panel-actions')]//span",
    'accordion-standard-standard-default-icon': "//div[@name='accordionpane2']//div[contains(@class,'panel-heading')]//div[contains(@class,'panel-actions')]//button",
    'accordion-standard-standard-default-text': "//div[@name='accordionpane2']//div[@class='heading' and text()='Title']",
    // -- standard-standard-active --
    'accordion-standard-standard-active-header': "//div[@name='accordionpane1']//div[contains(@class,'panel-heading') and contains(@class,'active')]",
    'accordion-standard-standard-active-body': "(//div[@name='accordionpane1']//div[contains(@class,'panel-body')])[1]",
    'accordion-standard-standard-active-title': "//div[@name='accordionpane1']//div[contains(@class,'panel-heading')]//h3//div//i",
    'accordion-standard-standard-active-subtitle': "//div[@name='accordionpane1']//div[@class='description']",
    'accordion-standard-standard-active-description': "//div[@name='accordionpane1']//div[@class='description']",
    'accordion-standard-standard-active-badge': "//div[@name='accordionpane1']//div[contains(@class,'panel-heading')]//div[contains(@class,'panel-actions')]//span",
    'accordion-standard-standard-active-icon': "//div[@name='accordionpane1']//div[contains(@class,'panel-heading')]//div[contains(@class,'panel-actions')]//button",
    'accordion-standard-standard-active-text': "//div[@name='accordionpane1']//div[@class='heading' and text()='Title']",
    // -- test-standard-default (existing extra variant) --
    'accordion-test-standard-default': '',
    'accordion-test-standard-default-header': "(//div[contains(@class,'panel-heading') and .//a[contains(@class,'accordion-toggle')]])[4]",
    'accordion-test-standard-default-body': "(//div[contains(@class,'panel-body')])[4]",
    'accordion-test-standard-default-title': "//div[@name='accordionpane1']//div[@class='heading' and text()='Title']",
    'accordion-test-standard-default-subtitle': "//div[@name='accordionpane1']//div[@class='description']",
    'accordion-test-standard-default-description': "//div[@name='accordionpane1']//div[@class='description']",
    'accordion-test-standard-default-badge': '',
    'accordion-test-standard-default-icon': '',
    'accordion-test-standard-default-text': '',

    // ==================== LABEL (sub-element: asterisk) ====================
    // H1-H6 Heading Variants
    'label-default-h1-default': "//label[@name='label1' and normalize-space()='H1']",
    'label-default-h2-default': "//label[@name='label2' and normalize-space()='H2']",
    'label-default-h3-default': "//label[@name='label3' and normalize-space()='H3']",
    'label-default-h4-default': "//label[@name='label4' and normalize-space()='H4']",
    'label-default-h5-default': "//label[@name='label5' and normalize-space()='H5']",
    'label-default-h6-default': "//label[@name='label6' and normalize-space()='H6']",

    // Media Heading Variant
    'label-default-media-heading-default': "//label[@name='label7' and normalize-space()='Media-Heading']",

    // Paragraph Variant
    'label-default-p-default': "//label[@name='label8' and normalize-space()='P']",

    // Text Color Variants
    'label-text-danger-default': "//label[@name='label10' and normalize-space()='Danger']",
    'label-text-info-default': "//label[@name='label11' and normalize-space()='info']",
    'label-text-muted-default': "//label[@name='label12' and normalize-space()='muted']",

    // Badge/Label Variants (with background)
    'label-label-primary-default': "//label[normalize-space()='primary']",
    'label-label-secondary-default': "//label[normalize-space()='secondary']",
    'label-label-tertiary-default': "//label[normalize-space()='tertiary']",
    'label-label-warning-default': "//label[normalize-space()='warning']",

    // ==================== PANEL (sub-elements: content, description, heading) ====================
    'panel-default-primary-default': "//div[@widget-id='wm_panel1']",
    'panel-default-primary-default-content': "//div[@widget-id='wm_panel1']//div[@class='panel-content']",
    'panel-default-primary-default-description': "//div[@widget-id='wm_panel1']//div[@class='panel-heading']//div[@class='description']",
    'panel-default-primary-default-heading': "//div[@widget-id='wm_panel1']//div[@class='panel-heading']",
    'panel-default-secondary-default': "//div[@widgettype='wm-panel' and @widget-id='wm_panel2']",
    'panel-default-secondary-default-content': "//div[@widget-id='wm_panel2']//div[@class='panel-content']",
    'panel-default-secondary-default-description': "//div[@widget-id='wm_panel2']//div[@class='panel-heading']//div[@class='description']",
    'panel-default-secondary-default-heading': "//div[@widget-id='wm_panel2']//div[@class='panel-heading']",

    // ==================== CARDS (sub-elements: header, body, footer, title, subtitle, button) ====================
    'cards-default-standard-default': "//div[@name='card1' and contains(@class,'card')]",
    'cards-default-standard-default-header': "//div[@name='card1']//div[contains(@class,'card-header')]",
    'cards-default-standard-default-body': "//div[@name='card1']//div[contains(@class,'card-body')]",
    'cards-default-standard-default-footer': "//div[@name='card1']//div[contains(@class,'card-footer')]",
    'cards-default-standard-default-title': "//div[@name='card1']//label[contains(@class,'card-title')]",
    'cards-default-standard-default-subtitle': "//div[@name='card1']//label[contains(@class,'card-subtitle')]",
    'cards-default-standard-default-button': "//div[@name='card1']//button[contains(@class,'btn-primary')]",
    'cards-filled-standard-default': "//div[@name='card2' and contains(@class,'card')]",
    'cards-filled-standard-default-header': "//div[@name='card2']//div[contains(@class,'card-header')]",
    'cards-filled-standard-default-body': "//div[@name='card2']//div[contains(@class,'card-body')]",
    'cards-filled-standard-default-footer': "//div[@name='card2']//div[contains(@class,'card-footer')]",
    'cards-filled-standard-default-title': "//div[@name='card2']//label[contains(@class,'card-title')]",
    'cards-filled-standard-default-subtitle': "//div[@name='card2']//label[contains(@class,'card-subtitle')]",
    'cards-filled-standard-default-button': "//div[@name='card2']//button[contains(@class,'btn-primary')]",

    // ==================== FORMCONTROLS (sub-elements: label, placeholder) ====================
    'formcontrols-standard-standard-default': "//form[@name='supportedLocaleForm1']//div[@widgettype='wm-form-field' and @name='entest']",
    'formcontrols-standard-standard-default-label': "//form[@name='supportedLocaleForm1']//div[@widgettype='wm-form-field' and @name='entest']//label[normalize-space()='En']",
    'formcontrols-standard-standard-default-placeholder': "//form[@name='supportedLocaleForm1']//input[@name='entest_formWidget']",
    'formcontrols-standard-standard-focused': "//form[@name='supportedLocaleForm1']//div[@widgettype='wm-form-field' and @name='entest']",
    'formcontrols-standard-standard-focused-label': "//form[@name='supportedLocaleForm1']//div[@widgettype='wm-form-field' and @name='entest']//label[normalize-space()='En']",
    'formcontrols-standard-standard-focused-placeholder': "//form[@name='supportedLocaleForm1']//input[@name='entest_formWidget']",
    'formcontrols-standard-standard-disabled': "//form[@name='supportedLocaleForm1']//div[@widgettype='wm-form-field' and @name='entest']",
    'formcontrols-standard-standard-disabled-label': "//form[@name='supportedLocaleForm1']//div[@widgettype='wm-form-field' and @name='entest']//label[normalize-space()='En']",
    'formcontrols-standard-standard-disabled-placeholder': "//form[@name='supportedLocaleForm1']//input[@name='entest_formWidget']",

    // ==================== FORM-WRAPPER (sub-elements: body, footer, header) ====================
    'form-wrapper-standard-standard-default': "//form[@name='supportedLocaleForm1' and contains(@class,'app-form')]",
    'form-wrapper-standard-standard-default-body': "//form[@name='supportedLocaleForm1']//div[contains(@class,'form-body') and contains(@class,'panel-body')]",
    'form-wrapper-standard-standard-default-footer': "//form[@name='supportedLocaleForm1']//div[contains(@class,'form-footer') or contains(@class,'basic-btn-grp')]",
    'form-wrapper-standard-standard-default-header': "//form[@name='supportedLocaleForm1']//div[contains(@class,'panel-heading')]",

    // ==================== NAVBAR (sub-elements: anchor, back-icon, badge, button, content, image, left-icon, menu-icon, popover-icon) ====================
    'navbar-standard-standard-default': "//header[@name='mobile_navbar1' and contains(@class,'app-mobile-navbar')]",
    'navbar-standard-standard-default-anchor': "//header[@name='mobile_navbar1']//a[@name='anchor3']//i[contains(@class,'wi-gear')]",
    'navbar-standard-standard-default-back-icon': "//header[@name='mobile_navbar1']//i[contains(@class,'sl-hamburger-menu')]",
    'navbar-standard-standard-default-badge': "//header[@name='mobile_navbar1']//nav[contains(@class,'navbar') and not(contains(@class,'searchbar'))]",
    'navbar-standard-standard-default-button': "//header[@name='mobile_navbar1']//button[@widgettype='wm-button' and @name='button9']",
    'navbar-standard-standard-default-content': "//header[@name='mobile_navbar1']//span[contains(@class,'title') and normalize-space()='MainPage']",
    'navbar-standard-standard-default-image': "//header[@name='mobile_navbar1']//nav[contains(@class,'navbar') and not(contains(@class,'searchbar'))]",
    'navbar-standard-standard-default-left-icon': "//header[@name='mobile_navbar1']//i[contains(@class,'sl-hamburger-menu')]",
    'navbar-standard-standard-default-menu-icon': "//header[@name='mobile_navbar1']//div[@widgettype='wm-menu' and @name='menu1']//button[contains(@class,'dropdown-toggle')]",
    'navbar-standard-standard-default-popover-icon': "//header[@name='mobile_navbar1']//a[@widgettype='wm-popover' and @name='popover1']//i[contains(@class,'wi-bell')]",

    // ==================== PICTURE (root-only) ====================
    'picture-default-circle-default': "//img[@widgettype='wm-picture' and @variant='default:circle']",
    'picture-default-rounded-default': "//img[@widgettype='wm-picture' and @variant='default:rounded']",
    'picture-thumbnail-standard-default': "//img[@widgettype='wm-picture' and @variant='thumbnail']",

    // ==================== CAROUSEL (sub-elements: dots, navigation-arrows, skeleton, slide) ====================
    // -- default state --
    'carousel-standard-standard-default': "//div[@widgettype='wm-carousel' and @name='carousel1']",
    'carousel-standard-standard-default-dots': "//div[@widgettype='wm-carousel' and @name='carousel1']//ol[contains(@class,'carousel-indicators')]",
    'carousel-standard-standard-default-navigation-arrows': "//div[@widgettype='wm-carousel' and @name='carousel1']//a[contains(@class,'left') and contains(@class,'carousel-control')]",
    'carousel-standard-standard-default-skeleton': "//div[@widgettype='wm-carousel' and @name='carousel1']",
    'carousel-standard-standard-default-slide': "//div[@widgettype='wm-carousel' and @name='carousel1']//slide[@widgettype='wm-carousel-content']",
    // -- active state --
    'carousel-standard-standard-active': "//div[@widgettype='wm-carousel' and @name='carousel1']",
    'carousel-standard-standard-active-dots': "//div[@widgettype='wm-carousel' and @name='carousel1']//li[contains(@class,'active')]",
    'carousel-standard-standard-active-navigation-arrows': "//div[@widgettype='wm-carousel' and @name='carousel1']//a[contains(@class,'right') and contains(@class,'carousel-control')]",
    'carousel-standard-standard-active-skeleton': "//div[@widgettype='wm-carousel' and @name='carousel1']",
    'carousel-standard-standard-active-slide': "//div[@widgettype='wm-carousel' and @name='carousel1']//slide[contains(@class,'active')]",

    // ==================== TABBAR (sub-elements: icon, item, menu, more-menu, more-menu-row, text) ====================
    // -- default state --
    'tabbar-standard-standard-default': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']",
    'tabbar-standard-standard-default-icon': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//a[@aria-label='Home']",
    'tabbar-standard-standard-default-item': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//li[contains(@class,'tab-item')]",
    'tabbar-standard-standard-default-menu': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//ul[contains(@class,'tab-items')]",
    'tabbar-standard-standard-default-more-menu': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//li[contains(@class,'menu-items')]",
    'tabbar-standard-standard-default-more-menu-row': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//ul[contains(@class,'dropdown-menu')]//a",
    'tabbar-standard-standard-default-text': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//a[@aria-label='Home']",
    // -- active state --
    'tabbar-standard-standard-active': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']",
    'tabbar-standard-standard-active-icon': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//li[contains(@class,'active')]//a",
    'tabbar-standard-standard-active-item': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//li[contains(@class,'tab-item') and contains(@class,'active')]",
    'tabbar-standard-standard-active-menu': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//ul[contains(@class,'tab-items')]",
    'tabbar-standard-standard-active-more-menu': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//li[contains(@class,'menu-items')]",
    'tabbar-standard-standard-active-more-menu-row': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//a[@aria-label='More options']",
    'tabbar-standard-standard-active-text': "//div[@widgettype='wm-mobile-tabbar' and @name='mobile_tabbar1']//li[contains(@class,'active')]//a",

    // ==================== BOTTOMSHEET (sub-elements: backdrop, content, handle) ====================
    'bottomsheet-standard-standard-default': "//div[@widgettype='wm-bottomsheet' and @name='bottomsheet1']//div[contains(@class,'app-bottomsheet-container')]",
    'bottomsheet-standard-standard-default-backdrop': "//div[@widgettype='wm-bottomsheet' and @name='bottomsheet1']//div[contains(@class,'app-bottomsheet-backdrop')]",
    'bottomsheet-standard-standard-default-content': "//div[@widgettype='wm-bottomsheet' and @name='bottomsheet1']//div[contains(@class,'app-bottomsheet-content')]",
    'bottomsheet-standard-standard-default-handle': "//div[@widgettype='wm-bottomsheet' and @name='bottomsheet1']//div[contains(@class,'app-bottomsheet-drag-icon-handle')]",

    // ==================== BARCODESCANNER (sub-elements: icon, text) ====================
    'barcodescanner-standard-standard-default': "//button[@widgettype='wm-barcodescanner' and @name='barcodescanner1']",
    'barcodescanner-standard-standard-default-icon': "//button[@widgettype='wm-barcodescanner' and @name='barcodescanner1']//i[contains(@class,'glyphicon-barcode')]",
    'barcodescanner-standard-standard-default-text': "//button[@widgettype='wm-barcodescanner' and @name='barcodescanner1']//span[contains(@class,'btn-caption')]",

    // ==================== TABS (sub-elements: heading, item) ====================
    'tabs-standard-standard-default': "//div[@widgettype='wm-tabs' and @name='tabs1']",
    'tabs-standard-standard-default-heading': "//div[@widgettype='wm-tabs' and @name='tabs1']//ul[contains(@class,'nav-tabs')]",
    'tabs-standard-standard-default-item': "//div[@widgettype='wm-tabs' and @name='tabs1']//li[contains(@class,'tab-header') and not(contains(@class,'active'))]",
    'tabs-standard-standard-active': "//div[@widgettype='wm-tabs' and @name='tabs1']",
    'tabs-standard-standard-active-heading': "//div[@widgettype='wm-tabs' and @name='tabs1']//ul[contains(@class,'nav-tabs')]",
    'tabs-standard-standard-active-item': "//div[@widgettype='wm-tabs' and @name='tabs1']//li[contains(@class,'tab-header') and contains(@class,'active')]",

    // ==================== LIST (root-only) ====================
    'list-standard-standard-default': "//div[@widgettype='wm-list' and @name='EmployeeList1']//ul[contains(@class,'app-livelist-container') and contains(@class,'list-group')]",

    // ==================== WIZARD (sub-elements: body, heading, step) ====================
    'wizard-standard-standard-default': "//div[@widgettype='wm-wizard' and @name='wizard1']",
    'wizard-standard-standard-default-body': "//div[@widgettype='wm-wizard' and @name='wizard1']//div[contains(@class,'app-wizard-body')]",
    'wizard-standard-standard-default-heading': "//div[@widgettype='wm-wizard' and @name='wizard1']//ul[contains(@class,'app-wizard-steps')]",
    'wizard-standard-standard-default-step': "//div[@widgettype='wm-wizard' and @name='wizard1']//li[contains(@class,'app-wizard-step') and contains(@class,'disabled')]",
    'wizard-standard-standard-current': "//div[@widgettype='wm-wizard' and @name='wizard1']",
    'wizard-standard-standard-current-body': "//div[@widgettype='wm-wizard' and @name='wizard1']//form[@widgettype='wm-wizardstep' and contains(@class,'current')]",
    'wizard-standard-standard-current-heading': "//div[@widgettype='wm-wizard' and @name='wizard1']//ul[contains(@class,'app-wizard-steps')]",
    'wizard-standard-standard-current-step': "//div[@widgettype='wm-wizard' and @name='wizard1']//li[contains(@class,'app-wizard-step') and contains(@class,'current')]",
    'wizard-standard-standard-active': "//div[@widgettype='wm-wizard' and @name='wizard1']",
    'wizard-standard-standard-active-body': "//div[@widgettype='wm-wizard' and @name='wizard1']//div[contains(@class,'app-wizard-body')]",
    'wizard-standard-standard-active-heading': "//div[@widgettype='wm-wizard' and @name='wizard1']//ul[contains(@class,'app-wizard-steps')]",
    'wizard-standard-standard-active-step': "//div[@widgettype='wm-wizard' and @name='wizard1']//li[contains(@class,'app-wizard-step') and contains(@class,'current')]",

    // ==================== CONTAINER (root-only) ====================
    'container-default-standard-default': "//div[@widgettype='wm-container' and @name='container1']",
    'container-outlined-standard-default': "//div[@widgettype='wm-container' and @name='container2']",
    'container-elevated-standard-default': "//div[@widgettype='wm-container' and @name='container3']",

    // ==================== TILE (root-only) ====================
    'tile-default-primary-default': "//*[@widgettype='wm-tile' and @variant='default:primary']",
    'tile-filled-danger-default': "//*[@widgettype='wm-tile' and @variant='filled:danger']",

    // ==================== BUTTON-GROUP (root-only) ====================
    'button-group-standard-standard-default': "//div[@widgettype='wm-buttongroup' and @name='buttongroup1']",

    // ==================== CHIPS (sub-elements: input, item, list) ====================
    // -- filled-primary --
    'chips-filled-primary-default': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]",
    'chips-filled-primary-default-input': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]//input[@type='text']",
    'chips-filled-primary-default-item': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]//li[contains(@class,'chip-item')]",
    'chips-filled-primary-default-list': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]",
    'chips-filled-primary-disabled': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and @disabled='true']",
    'chips-filled-primary-disabled-input': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and @disabled='true']//input[@type='text']",
    'chips-filled-primary-disabled-item': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and @disabled='true']//li[contains(@class,'chip-item')]",
    'chips-filled-primary-disabled-list': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and @disabled='true']",
    'chips-filled-primary-active': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]",
    'chips-filled-primary-active-input': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]//input[@type='text']",
    'chips-filled-primary-active-item': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]//li[contains(@class,'active')]",
    'chips-filled-primary-active-list': "//ul[@widgettype='wm-chips' and @variant='filled:primary' and not(@disabled)]",
    // -- elevated-standard --
    'chips-elevated-standard-default': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]",
    'chips-elevated-standard-default-input': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]//input[@type='text']",
    'chips-elevated-standard-default-item': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]//li[contains(@class,'chip-item')]",
    'chips-elevated-standard-default-list': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]",
    'chips-elevated-standard-disabled': "//ul[@widgettype='wm-chips' and @variant='elevated' and @disabled='true']",
    'chips-elevated-standard-disabled-input': "//ul[@widgettype='wm-chips' and @variant='elevated' and @disabled='true']//input[@type='text']",
    'chips-elevated-standard-disabled-item': "//ul[@widgettype='wm-chips' and @variant='elevated' and @disabled='true']//li[contains(@class,'chip-item')]",
    'chips-elevated-standard-disabled-list': "//ul[@widgettype='wm-chips' and @variant='elevated' and @disabled='true']",
    'chips-elevated-standard-active': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]",
    'chips-elevated-standard-active-input': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]//input[@type='text']",
    'chips-elevated-standard-active-item': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]//li[contains(@class,'active')]",
    'chips-elevated-standard-active-list': "//ul[@widgettype='wm-chips' and @variant='elevated' and not(@disabled)]",

    // ==================== RADIOSET (sub-elements: indicator, label, set, title) ====================
    'radioset-standard-standard-default': "//ul[@widgettype='wm-radioset' and @name='radioset1']//li[contains(@class,'app-radio')]",
    'radioset-standard-standard-default-indicator': "//ul[@widgettype='wm-radioset' and @name='radioset1']//input[@type='radio']",
    'radioset-standard-standard-default-label': "//ul[@widgettype='wm-radioset' and @name='radioset1']//li[contains(@class,'app-radio')]//label",
    'radioset-standard-standard-default-set': "//ul[@widgettype='wm-radioset' and @name='radioset1']",
    'radioset-standard-standard-default-title': "//ul[@widgettype='wm-radioset' and @name='radioset1']",
    'radioset-standard-standard-checked': "//ul[@widgettype='wm-radioset' and @name='radioset1']//li[contains(@class,'app-radio')]",
    'radioset-standard-standard-checked-indicator': "//ul[@widgettype='wm-radioset' and @name='radioset1']//input[@type='radio' and @aria-checked='true']",
    'radioset-standard-standard-checked-label': "//ul[@widgettype='wm-radioset' and @name='radioset1']//label[.//input[@aria-checked='true']]",
    'radioset-standard-standard-checked-set': "//ul[@widgettype='wm-radioset' and @name='radioset1']",
    'radioset-standard-standard-checked-title': "//ul[@widgettype='wm-radioset' and @name='radioset1']",
    'radioset-standard-standard-disabled': "//ul[@widgettype='wm-radioset' and @name='radioset1']//li[contains(@class,'app-radio')]",
    'radioset-standard-standard-disabled-indicator': "//ul[@widgettype='wm-radioset' and @name='radioset1']//input[@type='radio' and @disabled]",
    'radioset-standard-standard-disabled-label': "//ul[@widgettype='wm-radioset' and @name='radioset1']//label[.//input[@disabled]]",
    'radioset-standard-standard-disabled-set': "//ul[@widgettype='wm-radioset' and @name='radioset1']",
    'radioset-standard-standard-disabled-title': "//ul[@widgettype='wm-radioset' and @name='radioset1']",

    // ==================== CHECKBOX (sub-elements: icon, label) ====================
    'checkbox-standard-standard-default': "//div[@widgettype='wm-checkbox' and @name='checkbox1']",
    'checkbox-standard-standard-default-icon': "//div[@widgettype='wm-checkbox' and @name='checkbox1']//input[@type='checkbox' and @aria-checked='false']",
    'checkbox-standard-standard-default-label': "//div[@widgettype='wm-checkbox' and @name='checkbox1']//span[contains(@class,'caption')]",
    'checkbox-standard-standard-checked': "//div[@widgettype='wm-checkbox' and @name='checkbox1']",
    'checkbox-standard-standard-checked-icon': "//div[@widgettype='wm-checkbox' and @name='checkbox1']//input[@type='checkbox' and @aria-checked='true']",
    'checkbox-standard-standard-checked-label': "//div[@widgettype='wm-checkbox' and @name='checkbox1']//span[contains(@class,'caption')]",
    'checkbox-standard-standard-disabled': "//div[@widgettype='wm-checkbox' and @name='checkbox1']",
    'checkbox-standard-standard-disabled-icon': "//div[@widgettype='wm-checkbox' and @name='checkbox1']//input[@type='checkbox' and @disabled]",
    'checkbox-standard-standard-disabled-label': "//div[@widgettype='wm-checkbox' and @name='checkbox1']//span[contains(@class,'caption')]",

    // ==================== CHECKBOXSET (sub-elements: icon, item, label, title) ====================
    'checkboxset-standard-standard-default': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']",
    'checkboxset-standard-standard-default-icon': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//input[@type='checkbox']",
    'checkboxset-standard-standard-default-item': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//li[contains(@class,'app-checkbox')]",
    'checkboxset-standard-standard-default-label': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//li[contains(@class,'app-checkbox')]//label",
    'checkboxset-standard-standard-default-title': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']",
    'checkboxset-standard-standard-checked': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']",
    'checkboxset-standard-standard-checked-icon': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//input[@type='checkbox' and @aria-checked='true']",
    'checkboxset-standard-standard-checked-item': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//li[contains(@class,'app-checkbox')]",
    'checkboxset-standard-standard-checked-label': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//label[.//input[@aria-checked='true']]",
    'checkboxset-standard-standard-checked-title': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']",
    'checkboxset-standard-standard-disabled': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1' and @disabled]",
    'checkboxset-standard-standard-disabled-icon': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//input[@type='checkbox' and @disabled]",
    'checkboxset-standard-standard-disabled-item': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//li[contains(@class,'app-checkbox')]",
    'checkboxset-standard-standard-disabled-label': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1']//label[.//input[@disabled]]",
    'checkboxset-standard-standard-disabled-title': "//ul[@widgettype='wm-checkboxset' and @name='checkboxset1' and @disabled]",

    // ==================== TOGGLE (sub-element: handle) ====================
    'toggle-standard-standard-default': "//div[@widgettype='wm-checkbox' and @name='toggle1' and @type='toggle']",
    'toggle-standard-standard-default-handle': "//div[@widgettype='wm-checkbox' and @name='toggle1']//input[@aria-checked='false']",
    'toggle-standard-standard-on': "//div[@widgettype='wm-checkbox' and @name='toggle1' and @type='toggle']",
    'toggle-standard-standard-on-handle': "//div[@widgettype='wm-checkbox' and @name='toggle1']//input[@aria-checked='true']",
    'toggle-standard-standard-disabled': "//div[@widgettype='wm-checkbox' and @name='toggle1' and @type='toggle']",
    'toggle-standard-standard-disabled-handle': "//div[@widgettype='wm-checkbox' and @name='toggle1']//input[@type='checkbox' and @disabled]",

    // ==================== SWITCH (sub-element: button) ====================
    'switch-standard-standard-default': "//div[@widgettype='wm-switch' and @name='switch1']",
    'switch-standard-standard-default-button': "//div[@widgettype='wm-switch' and @name='switch1']//a[not(contains(@class,'selected'))]",
    'switch-standard-standard-selected': "//div[@widgettype='wm-switch' and @name='switch1']",
    'switch-standard-standard-selected-button': "//div[@widgettype='wm-switch' and @name='switch1']//a[contains(@class,'selected')]",
    'switch-standard-standard-disabled': "//div[@widgettype='wm-switch' and @name='switch1' and @disabled]",
    'switch-standard-standard-disabled-button': "//div[@widgettype='wm-switch' and @name='switch1' and @disabled]//a",

    // ==================== CALENDAR (sub-elements: day, daywrapper, event-day1, header, header-skeleton, month-text, not-day-of-month, selected-day, text, today, weekday, wrapper, year-text) ====================
    'calendar-standard-standard-default': "//div[@widgettype='wm-calendar' and @name='calendar1' and contains(@class,'app-calendar')]",
    'calendar-standard-standard-default-day': "//div[@widgettype='wm-calendar' and @name='calendar1']//td[contains(@class,'fc-daygrid-day')]",
    'calendar-standard-standard-default-daywrapper': "//div[@widgettype='wm-calendar' and @name='calendar1']//td[contains(@class,'fc-daygrid-day')]",
    'calendar-standard-standard-default-event-day1': "//div[@widgettype='wm-calendar' and @name='calendar1']//td[contains(@class,'fc-daygrid-day')]",
    'calendar-standard-standard-default-header': "//div[@widgettype='wm-calendar' and @name='calendar1']//div[contains(@class,'fc-header-toolbar')]",
    'calendar-standard-standard-default-header-skeleton': "//div[@widgettype='wm-calendar' and @name='calendar1']//div[contains(@class,'fc-header-toolbar')]",
    'calendar-standard-standard-default-month-text': "//div[@widgettype='wm-calendar' and @name='calendar1']//h2[contains(@class,'fc-toolbar-title')]",
    'calendar-standard-standard-default-not-day-of-month': "//div[@widgettype='wm-calendar' and @name='calendar1']//td[contains(@class,'fc-day-other')]",
    'calendar-standard-standard-default-selected-day': "//div[@widgettype='wm-calendar' and @name='calendar1']//td[contains(@class,'fc-day-today')]",
    'calendar-standard-standard-default-text': "//div[@widgettype='wm-calendar' and @name='calendar1']//td[contains(@class,'fc-daygrid-day')]//a[contains(@class,'fc-daygrid-day-number')]",
    'calendar-standard-standard-default-today': "//div[@widgettype='wm-calendar' and @name='calendar1']//td[contains(@class,'fc-day-today')]",
    'calendar-standard-standard-default-weekday': "//div[@widgettype='wm-calendar' and @name='calendar1']//th[contains(@class,'fc-col-header-cell')]",
    'calendar-standard-standard-default-wrapper': "//div[@widgettype='wm-calendar' and @name='calendar1']",
    'calendar-standard-standard-default-year-text': "//div[@widgettype='wm-calendar' and @name='calendar1']//h2[contains(@class,'fc-toolbar-title')]",

    // ==================== SLIDER (sub-elements: max-track, min-track, thumb, tooltip, track) ====================
    'slider-standard-standard-default': "//div[@widgettype='wm-slider' and @name='slider1' and contains(@class,'app-slider')]",
    'slider-standard-standard-default-max-track': "//div[@widgettype='wm-slider' and @name='slider1']//input[@type='range' and @name='slider1']",
    'slider-standard-standard-default-min-track': "//div[@widgettype='wm-slider' and @name='slider1']//input[@type='range' and @name='slider1']",
    'slider-standard-standard-default-thumb': "//div[@widgettype='wm-slider' and @name='slider1']//input[@type='range' and @name='slider1']",
    'slider-standard-standard-default-tooltip': "//div[@widgettype='wm-slider' and @name='slider1']//span[contains(@class,'pull-left')]",
    'slider-standard-standard-default-track': "//div[@widgettype='wm-slider' and @name='slider1']//input[@type='range' and @name='slider1']",

    // ==================== RATING (sub-elements: icon, text) ====================
    'rating-standard-standard-default': "//div[@widgettype='wm-rating' and @name='rating1' and contains(@class,'app-ratings')]",
    'rating-standard-standard-default-icon': "//div[@widgettype='wm-rating' and @name='rating1']//input[@type='radio' and @aria-checked='false']",
    'rating-standard-standard-default-text': "//div[@widgettype='wm-rating' and @name='rating1']",
    'rating-standard-standard-disabled': "//div[@widgettype='wm-rating' and @name='rating1' and contains(@class,'app-ratings')]",
    'rating-standard-standard-disabled-icon': "//div[@widgettype='wm-rating' and @name='rating1']//input[@type='radio' and @disabled]",
    'rating-standard-standard-disabled-text': "//div[@widgettype='wm-rating' and @name='rating1']",
    'rating-standard-standard-active': "//div[@widgettype='wm-rating' and @name='rating1' and contains(@class,'app-ratings')]",
    'rating-standard-standard-active-icon': "//div[@widgettype='wm-rating' and @name='rating1']//input[@type='radio' and @aria-checked='true']",
    'rating-standard-standard-active-text': "//div[@widgettype='wm-rating' and @name='rating1']//label[.//input[@aria-checked='true']]",

    // ==================== ANCHOR (sub-elements: icon, image, text) ====================
    'anchor-standard-primary-default': "//a[@widgettype='wm-anchor' and @name='anchor1']",
    'anchor-standard-primary-default-icon': "//a[@widgettype='wm-anchor' and @name='anchor1']//i",
    'anchor-standard-primary-default-image': "//a[@widgettype='wm-anchor' and @name='anchor1']//img",
    'anchor-standard-primary-default-text': "//a[@widgettype='wm-anchor' and @name='anchor1']//span[contains(@class,'anchor-caption')]",
    'anchor-default-secondary-default': "//a[@widgettype='wm-anchor' and @name='anchor2']",
    'anchor-default-secondary-default-icon': "//a[@widgettype='wm-anchor' and @name='anchor2']//i",
    'anchor-default-secondary-default-image': "//a[@widgettype='wm-anchor' and @name='anchor2']//img",
    'anchor-default-secondary-default-text': "//a[@widgettype='wm-anchor' and @name='anchor2']//span[contains(@class,'anchor-caption')]",

    // ==================== ICON (root-only) ====================
    'icon-default-2x-default': "//span[@widgettype='wm-icon' and @name='icon1']",
    'icon-default-5x-default': "//span[@widgettype='wm-icon' and @name='icon2']",

    // ==================== LOTTIE (root-only) ====================
    'lottie-standard-standard-default': "//div[@widgettype='wm-lottie' and @name='lottie1']",

    // ==================== AUDIO (root-only) ====================
    'audio-standard-standard-default': "//div[@widgettype='wm-audio' and @name='audio1']",

    // ==================== WEBVIEW (sub-element: container) ====================
    'webview-standard-standard-default': "//div[@widgettype='wm-webview' and @name='webview1']",
    'webview-standard-standard-default-container': "//div[@widgettype='wm-webview' and @name='webview1']//iframe[contains(@class,'iframe-content')]",

    // ==================== MESSAGE (sub-elements: close-btn, container, icon, text, text-wrapper, title) ====================
    'message-filled-error-default': "//p[@widgettype='wm-message' and @name='message1']",
    'message-filled-error-default-close-btn': "//p[@widgettype='wm-message' and @name='message1']//button[contains(@class,'close')]",
    'message-filled-error-default-container': "//p[@widgettype='wm-message' and @name='message1']",
    'message-filled-error-default-icon': "//p[@widgettype='wm-message' and @name='message1']//i[contains(@class,'error')]",
    'message-filled-error-default-text': "//p[@widgettype='wm-message' and @name='message1']//span[normalize-space()='Message']",
    'message-filled-error-default-text-wrapper': "//p[@widgettype='wm-message' and @name='message1']",
    'message-filled-error-default-title': "//p[@widgettype='wm-message' and @name='message1']",
    'message-filled-success-default': "//p[@widgettype='wm-message' and @name='message2']",
    'message-filled-success-default-close-btn': "//p[@widgettype='wm-message' and @name='message2']//button[contains(@class,'close')]",
    'message-filled-success-default-container': "//p[@widgettype='wm-message' and @name='message2']",
    'message-filled-success-default-icon': "//p[@widgettype='wm-message' and @name='message2']//i[contains(@class,'success')]",
    'message-filled-success-default-text': "//p[@widgettype='wm-message' and @name='message2']//span[normalize-space()='Message']",
    'message-filled-success-default-text-wrapper': "//p[@widgettype='wm-message' and @name='message2']",
    'message-filled-success-default-title': "//p[@widgettype='wm-message' and @name='message2']",

    // ==================== SPINNER (sub-elements: icon, lottie, text) ====================
    'spinner-standard-standard-default': "//div[@widgettype='wm-spinner' and @name='spinner1']",
    'spinner-standard-standard-default-icon': "//div[@widgettype='wm-spinner' and @name='spinner1']//i[contains(@class,'spinner-image')]",
    'spinner-standard-standard-default-lottie': "//div[@widgettype='wm-spinner' and @name='spinner1']//div[contains(@class,'spinner-message')]",
    'spinner-standard-standard-default-text': "//div[@widgettype='wm-spinner' and @name='spinner1']//span[contains(@class,'spinner-text')]",

    // ==================== SEARCH (sub-elements: btn, data-complete, dropdown, invalid, item, placeholder, text) ====================
    'search-standard-standard-default': "//div[@widgettype='wm-search' and @name='search1']",
    'search-standard-standard-default-btn': "//div[@widgettype='wm-search' and @name='search1']//button[contains(@class,'app-search-button')]",
    'search-standard-standard-default-data-complete': "//div[@widgettype='wm-search' and @name='search1']//input[@type='Search' and @name='search1']",
    'search-standard-standard-default-dropdown': "//div[@widgettype='wm-search' and @name='search1']//ul[contains(@class,'dropdown-menu')]",
    'search-standard-standard-default-invalid': "//div[@widgettype='wm-search' and @name='search1']//input[@type='Search' and @name='search1']",
    'search-standard-standard-default-item': "//div[@widgettype='wm-search' and @name='search1']//ul[contains(@class,'dropdown-menu')]//li",
    'search-standard-standard-default-placeholder': "//div[@widgettype='wm-search' and @name='search1']//input[@type='Search' and @name='search1']",
    'search-standard-standard-default-text': "//div[@widgettype='wm-search' and @name='search1']//input[@type='Search' and @name='search1']",

    // ==================== PROGRESS-BAR (sub-element: tooltip) ====================
    'progress-bar-filled-default-default': "//div[@wmprogressbar and contains(@class,'progress-bar-default')]",
    'progress-bar-filled-default-default-tooltip': "//div[@wmprogressbar and contains(@class,'progress-bar-default')]//span[contains(@class,'app-progress-label')]",
    'progress-bar-filled-info-default': "//div[@wmprogressbar and contains(@class,'progress-bar-info')]",
    'progress-bar-filled-info-default-tooltip': "//div[@wmprogressbar and contains(@class,'progress-bar-info')]//span[contains(@class,'app-progress-label')]",
    'progress-bar-filled-success-default': "//div[@wmprogressbar and contains(@class,'progress-bar-success')]",
    'progress-bar-filled-success-default-tooltip': "//div[@wmprogressbar and contains(@class,'progress-bar-success')]//span[contains(@class,'app-progress-label')]",
    'progress-bar-filled-warning-default': "//div[@wmprogressbar and contains(@class,'progress-bar-warning')]",
    'progress-bar-filled-warning-default-tooltip': "//div[@wmprogressbar and contains(@class,'progress-bar-warning')]//span[contains(@class,'app-progress-label')]",
    'progress-bar-filled-danger-default': "//div[@wmprogressbar and contains(@class,'progress-bar-danger')]",
    'progress-bar-filled-danger-default-tooltip': "//div[@wmprogressbar and contains(@class,'progress-bar-danger')]//span[contains(@class,'app-progress-label')]",

    // ==================== PROGRESS-CIRCLE (sub-elements: stroke, sub-title) ====================
    'progress-circle-filled-default-default': "(//div[@wmprogresscircle])[1]",
    'progress-circle-filled-default-default-stroke': "(//div[@wmprogresscircle])[1]//svg/circle[@r='90']",
    'progress-circle-filled-default-default-sub-title': "(//div[@wmprogresscircle])[1]//svg/text/tspan",
    'progress-circle-filled-info-default': "//div[contains(@class,'progress-circle-info') and @wmprogresscircle]",
    'progress-circle-filled-info-default-stroke': "//div[contains(@class,'progress-circle-info') and @wmprogresscircle]//svg/circle[@r='90']",
    'progress-circle-filled-info-default-sub-title': "//div[contains(@class,'progress-circle-info') and @wmprogresscircle]//svg/text/tspan",
    'progress-circle-filled-success-default': "//div[contains(@class,'progress-circle-success') and @wmprogresscircle]",
    'progress-circle-filled-success-default-stroke': "//div[contains(@class,'progress-circle-success') and @wmprogresscircle]//svg/circle[@r='90']",
    'progress-circle-filled-success-default-sub-title': "//div[contains(@class,'progress-circle-success') and @wmprogresscircle]//svg/text/tspan",
    'progress-circle-filled-warning-default': "//div[contains(@class,'progress-circle-warning') and @wmprogresscircle]",
    'progress-circle-filled-warning-default-stroke': "//div[contains(@class,'progress-circle-warning') and @wmprogresscircle]//svg/circle[@r='90']",
    'progress-circle-filled-warning-default-sub-title': "//div[contains(@class,'progress-circle-warning') and @wmprogresscircle]//svg/text/tspan",
    'progress-circle-filled-danger-default': "//div[contains(@class,'progress-circle-danger') and @wmprogresscircle]",
    'progress-circle-filled-danger-default-stroke': "//div[contains(@class,'progress-circle-danger') and @wmprogresscircle]//svg/circle[@r='90']",
    'progress-circle-filled-danger-default-sub-title': "//div[contains(@class,'progress-circle-danger') and @wmprogresscircle]//svg/text/tspan",

    // ==================== DROPDOWN-MENU (sub-element: menu) ====================
    'dropdown-menu-standard-standard-default': "//div[@wmmenu and @name='menu1']//button[@dropdowntoggle]",
    'dropdown-menu-standard-standard-default-menu': "//div[@wmmenu and @name='menu1']",

    // ==================== POPOVER (sub-elements: header, link) ====================
    'popover-standard-standard-default': "//a[@wmpopover and @name='popover1']",
    'popover-standard-standard-default-header': "//a[@wmpopover and @name='popover1']",
    'popover-standard-standard-default-link': "//a[@wmpopover and @name='popover1']//span[contains(@class,'anchor-caption')]",

    // ==================== LOGIN (sub-elements: error, form) ====================
    'login-standard-standard-default': "//div[@wmlogin and @name='loginForm']",
    'login-standard-standard-default-error': "//div[@wmlogin and @name='loginForm']//p[contains(@class,'app-login-message')]",
    'login-standard-standard-default-form': "//div[@wmlogin and @name='loginForm']//form[@wmform]",

    // ==================== MODAL-DIALOG (sub-elements: body, btn, description, footer, header, icon, title) ====================
    'modal-dialog-standard-standard-default': "//div[@wmdialog and @name='dialog1']",
    'modal-dialog-standard-standard-default-body': "//div[@wmdialog and @name='dialog1']//div[contains(@class,'dialog-view')]",
    'modal-dialog-standard-standard-default-btn': "//div[@wmdialog and @name='dialog1']//button",
    'modal-dialog-standard-standard-default-description': "//div[@wmdialog and @name='dialog1']//div[contains(@class,'dialog-view')]",
    'modal-dialog-standard-standard-default-footer': "//div[@wmdialog and @name='dialog1']//div[contains(@class,'dialog-view')]",
    'modal-dialog-standard-standard-default-header': "//div[@wmdialog and @name='dialog1']//div[contains(@class,'dialog-view')]",
    'modal-dialog-standard-standard-default-icon': "//div[@wmdialog and @name='dialog1']//div[contains(@class,'dialog-view')]",
    'modal-dialog-standard-standard-default-title': "//div[@wmdialog and @name='dialog1']//div[contains(@class,'dialog-view')]",

    // ==================== FILEUPLOAD (sub-elements: icon, text) ====================
    'fileupload-standard-standard-default': "//div[@wmfileupload and @name='fileupload1']",
    'fileupload-standard-standard-default-icon': "//div[@wmfileupload and @name='fileupload1']//button[@id='dropzone']//i[contains(@class,'wi-file-upload')]",
    'fileupload-standard-standard-default-text': "//div[@wmfileupload and @name='fileupload1']//button[@id='dropzone']//span[contains(@class,'caption')]",

    // ==================== CURRENCY (sub-elements: label, labelwrapper) ====================
    'currency-standard-standard-default': "//div[@widgettype='wm-currency' and @name='currency1']",
    'currency-standard-standard-default-label': "//div[@widgettype='wm-currency' and @name='currency1']//span[contains(@class,'input-group-addon')]",
    'currency-standard-standard-default-labelwrapper': "//div[@widgettype='wm-currency' and @name='currency1']//span[contains(@class,'input-group-addon')]",

    // ==================== SELECT (sub-elements: arrow-button, check, modal-content, modal-text) ====================
    'select-standard-standard-default': "//div[@widgettype='wm-select' and @name='select1']",
    'select-standard-standard-default-arrow-button': "//div[@widgettype='wm-select' and @name='select1']//button[contains(@class,'dropdown-toggle')]",
    'select-standard-standard-default-check': "//div[@widgettype='wm-select' and @name='select1']//ul[contains(@class,'dropdown-menu')]//i",
    'select-standard-standard-default-modal-content': "//div[@widgettype='wm-select' and @name='select1']//ul[contains(@class,'dropdown-menu')]",
    'select-standard-standard-default-modal-text': "//div[@widgettype='wm-select' and @name='select1']//ul[contains(@class,'dropdown-menu')]//li//a",

    // ==================== PANEL-FOOTER (root-only) ====================
    'panel-footer-standard-standard-default': "//div[contains(@class,'panel-footer')]",

    // ==================== CAMERA (root-only) ====================
    'camera-standard-standard-default': "//div[@widgettype='wm-camera' and @name='camera1']",

    // ==================== DATETIME (sub-elements: button, cancel-button, header-text, selected-button, selected, text) ====================
    'datetime-standard-standard-default': "//div[@widgettype='wm-datetime' and @name='datetime1']",
    'datetime-standard-standard-default-button': "//div[@widgettype='wm-datetime' and @name='datetime1']//button",
    'datetime-standard-standard-default-cancel-button': "//div[@widgettype='wm-datetime' and @name='datetime1']//button[contains(@class,'cancel')]",
    'datetime-standard-standard-default-header-text': "//div[@widgettype='wm-datetime' and @name='datetime1']//div[contains(@class,'header')]",
    'datetime-standard-standard-default-selected-button': "//div[@widgettype='wm-datetime' and @name='datetime1']//button[contains(@class,'selected')]",
    'datetime-standard-standard-default-text': "//div[@widgettype='wm-datetime' and @name='datetime1']//span[contains(@class,'display-text')]",

    // ==================== VIDEO (root-only) ====================
    'video-standard-standard-default': "//div[@widgettype='wm-video' and @name='video1']",
  },
  preview: {
    'button-filled-primary-default': "//div[@data-testid='button1_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-filled-primary-disabled': "//div[@data-testid='button2_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-filled-secondary-default': "//div[@data-testid='button3_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-filled-secondary-disabled': "//div[@data-testid='button4_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-outlined-tertiary-default': "//div[@data-testid='button5_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-outlined-tertiary-disabled': "//div[@data-testid='button6_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-text-info-default': "//div[@data-testid='button7_caption']/ancestor::div[2]",
    'button-text-info-disabled': "//div[@data-testid='button8_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-elevated-standard-default': "//div[@data-testid='button9_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'button-elevated-standard-disabled': "//div[@data-testid='button10_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'label-default-h1-default': "//div[contains(text(),'H1')]",
    'label-default-h2-default': "//div[contains(text(),'H2')]",
    'label-default-h3-default': "//div[contains(text(),'H3')]",
    'label-default-h4-default': "//div[contains(text(),'H4')]",
    'label-default-h5-default': "//div[contains(text(),'H5')]",
    'label-default-h6-default': "//div[contains(text(),'H6')]",
    'label-default-media-heading-default': "//div[@aria-label='label19_caption']",
    'label-default-p-default': "//div[@aria-label='label20_caption']",
    'label-text-muted-default': "//div[@aria-label='label11_caption']",
    'label-text-danger-default': "//div[@aria-label='label9_caption']",
    'label-text-info-default': "//div[@aria-label='label10_caption']",
    'label-label-primary-default': "//*[@data-testid='label14_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'label-label-secondary-default': "//*[@data-testid='label18_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'label-label-tertiary-default': "//*[@data-testid='label15_caption']/ancestor::div[@data-testid='non_animatableView'][1]",
    'label-label-warning-default': "//*[@data-testid='label16_caption']/ancestor::div[@data-testid='non_animatableView'][1]",

    'accordion-standard-standard-default-header': "//div[@data-testid='accordion1_header0']",
    'accordion-standard-standard-default-body': "//div[@data-testid='accordion1_header0']/following-sibling::div[1]",

    'accordion-test-standard-default-header': "//div[@data-testid='accordion2_header0']",
    'accordion-test-standard-default-body': "//div[@data-testid='accordion2_header0']/following-sibling::div[1]",


    'panel-default-primary-default': "//div[@data-testid='panel1']",
    'panel-default-secondary-default': "//div[@data-testid='panel2']",

    'cards-default-standard-default': "//div[@data-testid='supportedLocaleList1_item0']//div[contains(@style,'--wm-card-background')]",
    'cards-filled-standard-default': "//div[@data-testid='supportedLocaleList1_1_item0']//div[contains(@style,'--wm-card-background')]",
  },
};

/**
 * Mobile selector matrix keyed by variant name (snapshotName) used in tests.
 *
 * Key format matches `${widget}-${appearance}-${variant}-${state}` e.g.
 *   - `button-filled-primary-default`
 *   - `button-outlined-success-disabled`
 *
 * For now, all button variants map to the same underlying RN button widget
 * in the mobile app; if that changes, update the per-variant selectors here.
 */
export const mobileWidgetSelectors = {
  android: {
    'button-filled-primary-default': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[7]',
    'button-filled-primary-disabled': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[10]',
    'button-filled-secondary-default': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[13]',
    'button-filled-secondary-disabled': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[16]',
    'button-outlined-tertiary-default': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[21]',
    'button-outlined-tertiary-disabled': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[24]',
    'button-text-info-default': '	(//android.view.ViewGroup[@resource-id="non_animatableView"])[29]',
    'button-text-info-disabled': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[32]',
    'button-elevated-standard-default': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[37]',
    'button-elevated-standard-disabled': '(//android.view.ViewGroup[@resource-id="non_animatableView"])[40]',

    'accordion-standard-standard-default': '~accordion1_header0',
    'label-standard-standard-default': '~label3_caption',
    'panel-standard-standard-default': '~panel1',
    'cards-standard-standard-default': '~supportedLocaleList1_item0',

    // New widgets
    'label-default-h1-default': '//android.widget.TextView[@content-desc="label1_caption" and @text="Default-Variants"]',
    'panel-default-primary-default': '~mobile_navbar1_title',
    'cards-default-standard-default': '~mobile_navbar1_title',

    // Form Controls
    'formcontrols-standard-standard-default': '~exinput_i',
    'formcontrols-standard-standard-focused': '~exinput_i',
    'formcontrols-standard-standard-disabled': '~exinput_i',

    // Form Wrapper
    'form-wrapper-standard-standard-default': '~entestkey_i',

    // Navbar
    'navbar-standard-standard-default': '~mobile_navbar1_title',
    'picture-default-rounded-default': '~picture1_picture',
    'picture-default-circle-default': '~picture2_picture',
    'picture-thumbnail-standard-default': '~picture3_picture',
    'carousel-standard-standard-default': '//android.view.ViewGroup[@resource-id="carousel_item_1"]',
    'tabbar-standard-standard-default': '~exinput_i',
    'bottomsheet-standard-standard-default': '//android.widget.ScrollView[@content-desc="bottomsheet1_scorllview"]/android.view.ViewGroup',
    'barcodescanner-standard-standard-default': '~barcodescanner1_button_icon_icon',
    'tabs-standard-standard-default': '~exinput_i',
    'list-standard-standard-default': '~mobile_navbar1_title',
    'chips-filled-primary-default': '~chips1_chip0',
    'chips-filled-primary-disabled': '~chips1_chip0',
    'chips-filled-primary-active': '~chips1_chip0',
    'chips-elevated-standard-default': '~chips2_chip0',
    'chips-elevated-standard-disabled': '~chips2_chip0',
    'chips-elevated-standard-active': '~chips2_chip0',
    'radioset-standard-standard-default': '~radioset1_radio0',
    'radioset-standard-standard-checked': '~radioset1_radio0',
    'radioset-standard-standard-disabled': '~radioset1_radio0',
    'checkbox-standard-standard-default': '~checkbox1_checkbox_icon',
    'checkbox-standard-standard-checked': '~checkbox1_checkbox_icon',
    'checkbox-standard-standard-disabled': '~checkbox1_checkbox_icon',
    'checkboxset-standard-standard-default': '~Option 1',
    'checkboxset-standard-standard-checked': '~	Option 1',
    'checkboxset-standard-standard-disabled': '~Option 1',
    'toggle-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'toggle-standard-standard-on': '//android.widget.TextView[@text="Home"]',
    'toggle-standard-standard-disabled': '//android.widget.TextView[@text="Home"]',
    'switch-standard-standard-default': '~switch1_label0',
    'switch-standard-standard-selected': '~switch1_label0',
    'switch-standard-standard-disabled': '~switch1_label0',
    'wizard-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'wizard-standard-standard-current': '//android.widget.TextView[@text="Home"]',
    'wizard-standard-standard-active': '//android.widget.TextView[@text="Home"]',
    'container-default-standard-default': '//android.widget.TextView[@text="Home"]',
    'container-outlined-standard-default': '//android.widget.TextView[@text="Home"]',
    'container-elevated-standard-default': '//android.widget.TextView[@text="Home"]',
    'tile-default-primary-default': '//android.widget.TextView[@text="Home"]',
    'tile-filled-danger-default': '//android.widget.TextView[@text="Home"]',
    'button-group-standard-standard-default': '~exinput_i',
    'anchor-standard-primary-default': '~exinput_i',
    'anchor-default-secondary-default': '~exinput_i',
    'webview-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'spinner-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'search-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'progress-bar-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'progress-bar-filled-default-default': '//android.widget.TextView[@text="Home"]',
    'progress-bar-filled-info-default': '//android.widget.TextView[@text="Home"]',
    'progress-bar-filled-success-default': '//android.widget.TextView[@text="Home"]',
    'progress-bar-filled-warning-default': '//android.widget.TextView[@text="Home"]',
    'progress-bar-filled-danger-default': '//android.widget.TextView[@text="Home"]',
    'progress-circle-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'progress-circle-filled-default-default': '//android.widget.TextView[@text="Home"]',
    'progress-circle-filled-info-default': '//android.widget.TextView[@text="Home"]',
    'progress-circle-filled-success-default': '//android.widget.TextView[@text="Home"]',
    'progress-circle-filled-warning-default': '//android.widget.TextView[@text="Home"]',
    'progress-circle-filled-danger-default': '//android.widget.TextView[@text="Home"]',
    'dropdown-menu-standard-standard-default': '//android.widget.TextView[@text="Home"]',
    'popover-standard-standard-default': '~exinput_i',
    'login-standard-standard-default': 'loggedInUserForm1_submit_formAction_a',
    'calendar-standard-standard-default': '~mobile_navbar1_leftnavbtn_a',
    'slider-standard-standard-default': '~mobile_navbar1_leftnavbtn_a',
    'rating-standard-standard-default': '~mobile_navbar1_leftnavbtn_a',
    'icon-default-2x-default': '~mobile_navbar1_leftnavbtn_a',
    'icon-default-5x-default': '~mobile_navbar1_leftnavbtn_a',
    'lottie-standard-standard-default': '~mobile_navbar1_leftnavbtn_a',
    'audio-standard-standard-default': '~mobile_navbar1_leftnavbtn_a',
    'message-filled-error-default': '~mobile_navbar1_leftnavbtn_a',
    'message-filled-success-default': '~mobile_navbar1_leftnavbtn_a',
    'modal-standard-standard-default': '~exinput_i',
    'fileupload-standard-standard-default': '~mobile_navbar1_leftnavbtn_a',
    'currency-standard-standard-default': '~exinput_i',
    'select-standard-standard-default': '~exinput_i',

  },
  ios: {
    'button-filled-primary-default': 'android=new UiSelector().description("buttonWidget")',
    'button-filled-primary-disabled': 'android=new UiSelector().description("buttonWidget")',
    'button-filled-secondary-default': 'android=new UiSelector().description("buttonWidget")',
    'button-filled-secondary-disabled': 'android=new UiSelector().description("buttonWidget")',
    'button-outlined-tertiary-default': 'android=new UiSelector().description("buttonWidget")',
    'button-outlined-tertiary-disabled': 'android=new UiSelector().description("buttonWidget")',
    'button-text-info-default': 'android=new UiSelector().description("buttonWidget")',
    'button-text-info-disabled': 'android=new UiSelector().description("buttonWidget")',
    'button-elevated-standard-default': 'android=new UiSelector().description("buttonWidget")',
    'button-elevated-standard-disabled': 'android=new UiSelector().description("buttonWidget")',
    'accordion-standard-standard-default': '**/XCUIElementTypeOther[`name == "accordionWidget"`]',

    // New widgets
    'label-default-h1-default': '**/XCUIElementTypeOther[`name == "labelWidget"`]',
    'panel-default-primary-default': '**/XCUIElementTypeOther[`name == "panelWidget"`]',
    'cards-default-standard-default': '**/XCUIElementTypeOther[`name == "cardsWidget"`]',

    // Navbar
    'navbar-standard-standard-default': '**/XCUIElementTypeOther[`name == "mobile_navbar1_title"`]',
    'tabbar-standard-standard-default': '~mobile_tabbar1',
    'bottomsheet-standard-standard-default': '~bottomsheet1',
    'barcodescanner-standard-standard-default': '~barcodescanner1',
    'tabs-standard-standard-default': '~exinput_i',
    'list-standard-standard-default': '~mobile_navbar1_title',
    'chips-filled-primary-default': '~chips1',
    'chips-filled-primary-disabled': '~chips1',
    'chips-filled-primary-active': '~chips1',
    'chips-elevated-standard-default': '~chips2',
    'chips-elevated-standard-disabled': '~chips2',
    'chips-elevated-standard-active': '~chips2',
    'radioset-standard-standard-default': '~radioset1',
    'radioset-standard-standard-checked': '~radioset1',
    'radioset-standard-standard-disabled': '~radioset1',
    'checkbox-standard-standard-default': '~checkbox1',
    'checkbox-standard-standard-checked': '~checkbox1',
    'checkbox-standard-standard-disabled': '~checkbox1',
    'checkboxset-standard-standard-default': '~checkboxset1',
    'checkboxset-standard-standard-checked': '~checkboxset1',
    'checkboxset-standard-standard-disabled': '~checkboxset1',
    'toggle-standard-standard-default': '~toggle1',
    'toggle-standard-standard-on': '~toggle1',
    'toggle-standard-standard-disabled': '~toggle1',
    'switch-standard-standard-default': '~switch1',
    'switch-standard-standard-selected': '~switch1',
    'switch-standard-standard-disabled': '~switch1',
    'wizard-standard-standard-default': '~wizard1',
    'wizard-standard-standard-current': '~wizard1',
    'wizard-standard-standard-active': '~wizard1',
    'container-default-standard-default': '~container1',
    'container-outlined-standard-default': '~container2',
    'container-elevated-standard-default': '~container3',
    'tile-default-primary-default': '~tile1',
    'tile-filled-danger-default': '~tile2',
    'button-group-standard-standard-default': '~buttongroup1',
    'anchor-standard-primary-default': '~anchor1',
    'anchor-default-secondary-default': '~anchor1',
    'webview-standard-standard-default': '~webview1',
    'spinner-standard-standard-default': '~spinner1',
    'search-standard-standard-default': '~search1',
    'progress-bar-filled-default-default': '~progress_bar1',
    'progress-bar-filled-info-default': '~progress_bar2',
    'progress-bar-filled-success-default': '~progress_bar3',
    'progress-bar-filled-warning-default': '~progress_bar4',
    'progress-bar-filled-danger-default': '~progress_bar5',
    'progress-circle-filled-default-default': '~progress_circle1',
    'progress-circle-filled-info-default': '~progress_circle2',
    'progress-circle-filled-success-default': '~progress_circle3',
    'progress-circle-filled-warning-default': '~progress_circle4',
    'progress-circle-filled-danger-default': '~progress_circle5',
    'dropdown-menu-standard-standard-default': '~menu1',
    'popover-standard-standard-default': '~popover1',
    'login-standard-standard-default': '~loginForm',
    'calendar-standard-standard-default': '~mobile_navbar1_leftnavbtn_a',
    'slider-standard-standard-default': '~slider1',
    'rating-standard-standard-default': '~rating1',
    'icon-default-2x-default': '~icon1',
    'icon-default-5x-default': '~icon2',
    'lottie-standard-standard-default': '~lottie1',
    'audio-standard-standard-default': '~audio1',
    'message-filled-error-default': '~message1',
    'message-filled-success-default': '~message2',
    'modal-standard-standard-default': '~dialog1',
    'fileupload-standard-standard-default': '~mobile_navbar1_title',
    'currency-standard-standard-default': '~exinput_i',
    'select-standard-standard-default': '~exinput_i',

  
  },
};
