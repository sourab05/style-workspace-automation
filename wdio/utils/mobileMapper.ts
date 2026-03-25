import type { Widget } from '../../src/matrix/widgets';
import { TokenMappingService } from '../../src/tokens/mappingService';

/**
 * Utility for mapping logical property paths to React Native style paths.
 * Ported from MobileWidgetPage.mapToRnStylePath to provide a single source of truth.
 */
export class MobileMapper {
    /**
     * Maps a logical property path (e.g. ['background'], ['header', 'color']) 
     * to a React Native style path (e.g. 'root.backgroundColor', 'header.color').
     */
 

static mapToRnStylePath(propertyPath: string[], widget: Widget,  platform: 'android' | 'ios' = 'android', state: string = 'default'
): string {
   if (!propertyPath || propertyPath.length === 0) return 'root';

   // Widgets whose states are handled externally (instance switching, calcStyles)
   // rather than via style-path namespaces. Strip the 'states.<state>' prefix
   // so downstream widget blocks receive the raw property path.
   const externalStateWidgets = ['formcontrols', 'radioset', 'toggle', 'switch'];
   if (externalStateWidgets.includes(widget) && propertyPath[0] === 'states' && propertyPath.length > 2) {
     propertyPath = propertyPath.slice(2);
   }

   const last = propertyPath[propertyPath.length - 1];
   const pathStr = propertyPath.join('.');
   const top = propertyPath[0];


   // ============================================================================
   // BUTTON-SPECIFIC MAPPINGS
   // ============================================================================
   if (widget === 'button') {
     let activePathStr = pathStr;
     let activeTop = top;
     let activePropertyPath = propertyPath;


     if (top === 'states' && (propertyPath[1] === 'disabled' || propertyPath[1] === 'hover')) {
       activePropertyPath = propertyPath.slice(2);
       activePathStr = activePropertyPath.join('.');
       activeTop = activePropertyPath[0];
     }


     const activeLast = activePropertyPath[activePropertyPath.length - 1];


     // --- Button properties ---
     // Background
     if (activePathStr === 'background' || activePathStr === 'background-color') {
       return 'root.backgroundColor';
     }


    // Text color
    if (activePathStr === 'color') {
      return 'root.color';
    }


     // Font properties
     if (activePathStr === 'font-family') return 'text.fontFamily';
     if (activePathStr === 'font-weight') return 'text.fontWeight';
     if (activePathStr === 'font-size') return 'text.fontSize';
     if (activePathStr === 'line-height') return 'text.lineHeight';
     if (activePathStr === 'letter-spacing') return 'text.letterSpacing';
     if (activePathStr === 'text-transform') return 'text.textTransform';


     // Border properties
     if (activeTop === 'border') {
       if (activePropertyPath.length === 2) {
         const prop = activePropertyPath[1];
         if (prop === 'color') return 'root.borderColor';
         if (prop === 'width') return 'root.borderTopWidth';
         if (prop === 'style') return 'root.borderStyle';
         if (prop === 'radius') return 'root.borderTopLeftRadius';
       }
     }


     // Padding properties
     if (activeTop === 'padding') {
       if (activePropertyPath.length === 2) {
         const direction = activePropertyPath[1];
         const directionCap = direction.charAt(0).toUpperCase() + direction.slice(1);
         return `root.padding${directionCap}`;
       }
       return 'root.paddingTop';
     }


     // Margin properties
     if (activeTop === 'margin') {
       if (activePropertyPath.length === 2) {
         const direction = activePropertyPath[1];
         const directionCap = direction.charAt(0).toUpperCase() + direction.slice(1);
         return `root.margin${directionCap}`;
       }
       return 'root.marginLeft';
     }


     // Gap
     if (activePathStr === 'gap') return 'content.gap';


     // Shadow
     if (activePathStr === 'shadow') return 'root.boxShadow';


     // Dimensions
     if (activePathStr === 'height') return 'root.minHeight';
     if (activePathStr === 'min-width') return 'root.minWidth';
     if (activePathStr === 'min-height') return 'root.minHeight';
     if (activePathStr === 'width') return 'root.width';


     // Radius (standalone)
     if (activePathStr === 'radius') return 'root.borderTopLeftRadius';


     // Ripple
     if (activePathStr === 'ripple.color' || (activeTop === 'ripple' && activeLast === 'color')) {
       return 'root.rippleColor';
     }


     // Position
     if (activeTop === 'position') {
       if (activePropertyPath.length === 1) return 'root.position';
       const computed = TokenMappingService.mapToComputedProperty(activeLast);
       return `root.${computed}`;
     }


     // Cursor
     if (activePathStr === 'cursor') return 'root.cursor';


     // Opacity
     if (activePathStr === 'opacity') return 'root.opacity';


    // Icon size
    if (activePathStr === 'icon-size') return 'icon.icon.fontSize';
    if (activePathStr === 'icon.size') return 'icon.icon.fontSize';
    if (activePathStr === 'icon.color') return 'icon.root.color';


     // Skeleton
     if (top === 'skeleton') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `skeleton.root.${prop}`;
     }
   }


   // ============================================================================
   // CARDS-SPECIFIC MAPPINGS
   // ============================================================================
   const cardsNamespaces = ['title', 'subtitle', 'header', 'footer', 'border', 'padding', 'root', 'picture', 'cardIcon', 'background', 'shadow'];
   if (widget === 'cards' && cardsNamespaces.includes(top)) {
     const prop = TokenMappingService.mapToComputedProperty(last);


     // title.color → title.text.color
     if (top === 'title') {
       return `title.text.${prop}`;
     }


     // subtitle.color → subheading.text.color
     if (top === 'subtitle' || top === 'subheading') {
       return `subheading.text.${prop}`;
     }


     // header.* → heading.*
     if (top === 'header' || top === 'heading') {
       if (propertyPath[1] === 'padding') {
         // Flatten padding if shorthand
         if (propertyPath.length === 2) return 'heading.paddingTop';
         const direction = propertyPath[2];
         const directionCap = direction.charAt(0).toUpperCase() + direction.slice(1);
         return `heading.padding${directionCap}`;
       }
       return `heading.${prop}`;
     }


     // picture.* -> picture.root.*
     if (top === 'picture') {
       return `picture.root.${prop}`;
     }


     // cardIcon.* -> cardIcon.root.*
     if (top === 'cardIcon') {
       return `cardIcon.root.${prop}`;
     }


    if (top === 'background') return 'root.backgroundColor';
    if (top === 'shadow') return 'root.boxShadow';


    // Border/Padding/Background/Shadow (At top level of calcStyles)
    if (['border', 'padding', 'root'].includes(top)) {
       if (top === 'padding' || propertyPath[1] === 'padding') {
         if (propertyPath.length === 1 || (top === 'padding' && propertyPath.length === 1)) return 'root.paddingTop';
         const direction = propertyPath[propertyPath.length - 1];
         const directionCap = direction.charAt(0).toUpperCase() + direction.slice(1);
         return `root.padding${directionCap}`;
       }
       if (top === 'border' || propertyPath[1] === 'border') {
         const firstCharTyped = prop.charAt(0).toUpperCase() + prop.slice(1);
         const borderProp = prop.toLowerCase().startsWith('border') ? prop : `border${firstCharTyped}`;
         return `root.${borderProp}`;
       }
       return prop;
     }


     return prop;
   }
   // ============================================================================
   // ACCORDION-SPECIFIC MAPPINGS
   // ============================================================================
   // --- Accordion-specific namespace routing scaffold ---
   const accordionNamespaces = [
     'root', 'header', 'firstHeader', 'lastHeader', 'activeHeader', 'badge', 'activeBadge',
    'pane', 'subheading', 'titleWrapper', 'titleIcon', 'activeTitleIcon', 'icon', 'default',
    'success', 'danger', 'warning', 'info', 'primary', 'title', 'text'
   ];
   if (widget === 'accordion' && accordionNamespaces.includes(top)) {
     // Handle nested icon blocks like icon.root or icon.icon
     if (top === 'icon') {
       const second = propertyPath[1];
       let prop = TokenMappingService.mapToComputedProperty(last);


       // Match specific font properties to their camelCase counterparts
       if (last === 'size') prop = 'fontSize';
       if (last === 'weight') prop = 'fontWeight';


       // icon.font.size -> icon.icon.fontSize
       if (second === 'font') {
         return `icon.icon.${prop}`;
       }


       // icon.color -> icon.icon.color
       if (propertyPath.length === 2 && second === 'color') {
         return 'icon.icon.color';
       }


       // General case: icon.root, etc.
       if (propertyPath.length > 1) {
         const sub = propertyPath[1];
         return `icon.${sub}.${prop}`;
       }
     }


     // Header-specific nested mappings
     if (top === 'header') {
       const second = propertyPath[1];
       const third = propertyPath[2];
       const fourth = propertyPath[3];


       // header.border.bottom-width → header.borderBottom.Width
       if (second === 'border' && third === 'bottom-width') {
         return 'header.borderBottomWidth';
       }


       // header.border.bottom.width → header.borderBottomWidth (Fallback for other structures)
       if (second === 'border' && third === 'bottom' && fourth === 'width') {
         return 'header.borderBottomWidth';
       }


       // header.border.color → header.borderColor
       if (second === 'border' && third === 'color') {
         return 'header.borderColor';
       }


       // header.subtitle.* → subheading.*
       if (second === 'subtitle') {
         const prop = TokenMappingService.mapToComputedProperty(last);
         if (third === 'margin' && fourth) {
           const direction = fourth.charAt(0).toUpperCase() + fourth.slice(1);
           return `subheading.margin${direction}`;
         }
         return `subheading.${prop}`;
       }


       // header.padding.* → header.padding[Direction]
       if (second === 'padding' && third) {
         const direction = third.charAt(0).toUpperCase() + third.slice(1);
         return `header.padding${direction}`;
       }


       // header.border.width → header.borderWidth
       if (second === 'border' && third === 'width') {
         return 'header.borderTopWidth';
       }


       // header.background-color → header.backgroundColor
       // header.color → header.color
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `header.${prop}`;
     }


     // --- Badge-specific nested mappings (CLEAN REWRITE) ---
     if (top === 'badge') {
       const second = propertyPath[1];
       const third = propertyPath[2];


       // badge.border.width → badge.borderWidth
       if (second === 'border' && third === 'width') {
         return 'badge.borderTopWidth';
       }


       // badge.border.color → badge.borderColor
       if (second === 'border' && third === 'color') {
         return 'badge.borderColor';
       }


       // badge.margin-right → badge.marginRight
       if (second === 'margin-right') {
         return 'badge.marginRight';
       }


       // badge.width / badge.height / badge.background-color
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `badge.${prop}`;
     }


     // --- ActiveBadge-specific nested mappings ---
     if (top === 'activeBadge') {
       const second = propertyPath[1];
       const third = propertyPath[2];
       if (second === 'border' && third === 'width') {
         return 'activeBadge.borderTopWidth';
       }
       if (second === 'border' && third === 'color') {
         return 'activeBadge.borderColor';
       }
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `activeBadge.${prop}`;
     }


     // --- firstHeader / lastHeader / activeHeader generic mapping ---
     if (['firstHeader', 'lastHeader', 'activeHeader'].includes(top)) {
       const second = propertyPath[1];
       const third = propertyPath[2];
       const fourth = propertyPath[3];


       // Example: firstHeader.border.top.leftRadius, lastHeader.border.bottom.width
       if (second === 'border' && third && fourth) {
         const group = third.charAt(0).toUpperCase() + third.slice(1);
         const prop = TokenMappingService.mapToComputedProperty(fourth);
         return `${top}.border${group}${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
       }


       const prop = TokenMappingService.mapToComputedProperty(last);
       return `${top}.${prop}`;
     }


     // --- Title specific mappings (e.g. title.icon.size -> titleIcon.fontSize) ---
     if (top === 'title') {
       const second = propertyPath[1];
       const third = propertyPath[2];
       if (second === 'icon') {
         if (third === 'size') return 'titleIcon.icon.fontSize';
         if (third === 'color') return 'titleIcon.icon.color';
       }
     }


     // --- icon.root / icon.icon mapping already partially handled ---


     // Accordion border.* → root.border*
     if (top === 'border') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       const borderProp = `border${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
       return `root.${borderProp}`;
     }


     // Text → header/activeHeaderTitle mappings
     if (top === 'text') {
       if (last === 'color') return 'header.color';
       if (last === 'font-size') return 'activeHeaderTitle.fontSize';
     }


     // Standard namespace mapping
     const prop = TokenMappingService.mapToComputedProperty(last);
     return `${top}.${prop}`;
   }


   // ============================================================================
   // LABEL-SPECIFIC MAPPINGS
   // ============================================================================
   const labelNamespaces = ['text', 'root', 'asterisk', 'skeleton', 'link'];
   if (widget === 'label' && labelNamespaces.includes(top)) {
     // Text properties (font-size, font-weight, font-family, color, line-height, letter-spacing)
     if (top === 'text') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `text.${prop}`;
     }


     // Root properties (margin, padding, color, background)
     if (top === 'root') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `root.${prop}`;
     }


     // Asterisk properties (color, margin)
     if (top === 'asterisk') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `asterisk.${prop}`;
     }


     // Skeleton properties
     if (top === 'skeleton') {
       const second = propertyPath[1];
       if (second === 'root') {
         const prop = TokenMappingService.mapToComputedProperty(last);
         return `skeleton.root.${prop}`;
       }
       return `skeleton.${TokenMappingService.mapToComputedProperty(last)}`;
     }


     // Link properties
     if (top === 'link') {
       const second = propertyPath[1];
       if (second === 'text') {
         const prop = TokenMappingService.mapToComputedProperty(last);
         return `link.text.${prop}`;
       }
       return `link.${TokenMappingService.mapToComputedProperty(last)}`;
     }
   }


   // ============================================================================
   // PANEL-SPECIFIC MAPPINGS
   // ============================================================================
   const panelNamespaces = [
     'root', 'text', 'header', 'heading', 'subheading', 'subHeading', 'icon', 'toggleIcon',
     'badge', 'default', 'success', 'danger', 'warning', 'info', 'primary', 'skeleton', 'footer', 'content', 'actions', 'description'
   ];
   if (widget === 'panel' && panelNamespaces.includes(top)) {
     // Text properties (color, font-family, font-size, font-weight, etc.)
     if (top === 'text') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `text.${prop}`;
     }


    // Description properties (color, font*) -> subHeading.*
    if (top === 'description') {
      if (last === 'letter-spacing') return 'subheading.letterSpacing';
      if (last === 'font-size') return 'subheading.fontSize';
      const prop = TokenMappingService.mapToComputedProperty(last);
      return `subheading.${prop}`;
    }


     // Root properties (backgroundColor, borderColor, borderWidth, borderRadius, padding, boxShadow)
     if (top === 'root') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `root.${prop}`;
     }


     // Header properties (backgroundColor, padding*, border*)
     if (top === 'header') {
       const second = propertyPath[1];
       const prop = TokenMappingService.mapToComputedProperty(last);


       // header.padding.block/inline or header.padding.top/bottom/left/right
       if (second === 'padding') {
         if (propertyPath.length === 3) {
           const direction = propertyPath[2];
           // React Native supports paddingInline and paddingBlock in modern versions
           if (['inline', 'block'].includes(direction)) {
             return `header.padding${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
           }
           if (direction === 'horizontal') return 'header.paddingHorizontal';
           if (direction === 'vertical') return 'header.paddingVertical';
           const directionCap = direction.charAt(0).toUpperCase() + direction.slice(1);
           return `header.padding${directionCap}`;
         }
         return 'header.paddingInline'; // Default shorthand to block/inline as seen in trace
       }


       // header.border.* -> header.border*
       if (second === 'border') {
         const borderProp = `border${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
         return `header.${borderProp}`;
       }


       return `header.${prop}`;
     }


     // Footer properties (backgroundColor, padding, border*)
     if (top === 'footer') {
       const second = propertyPath[1];
       const prop = TokenMappingService.mapToComputedProperty(last);


       // footer.border.width -> footer.borderWidth
       if (second === 'border') {
         const borderProp = `border${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
         return `footer.${borderProp}`;
       }


       // footer.padding -> footer.padding
       if (second === 'padding') {
         return 'footer.paddingTop';
       }


       // footer.background -> footer.backgroundColor
       return `footer.${prop}`;
     }


    // Content properties (padding, gap)
    if (top === 'content') {
      if (last === 'padding') return 'root.paddingTop';
      const prop = TokenMappingService.mapToComputedProperty(last);
      return `root.${prop}`; // Content properties are usually on root in panel (e.g. contentPadding)
    }


     // Actions properties (gap)
     if (top === 'actions') {
       return 'root.actionsGap'; // actions.gap -> root.actionsGap as seen in CSS vars
     }


    // Heading properties (Redirect based on property type)
    if (top === 'heading') {
      const second = propertyPath[1];
      const third = propertyPath[2];
      const prop = TokenMappingService.mapToComputedProperty(last);

     // heading.icon.color -> icon.text.color
     if (second === 'icon' && third === 'color') {
       return 'icon.text.color';
     }
     if (second === 'icon' && third === 'size') {
       return 'icon.text.fontSize';
     }
     if (last === 'color') return 'text.color';
     if (last === 'font-weight') return 'text.fontWeight';
     if (last === 'line-height') return 'text.lineHeight';
     if (last === 'font-size') return 'text.fontSize';
     if (last === 'letter-spacing') return 'text.letterSpacing';


       // heading.padding.* or heading.gap -> header.*
       if (second === 'padding' || second === 'gap') {
         if (second === 'padding' && propertyPath.length === 3) {
           const direction = propertyPath[2];
           if (['inline', 'block'].includes(direction)) {
             return `header.padding${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
           }
           if (direction === 'horizontal') return 'heading.paddingHorizontal';
           if (direction === 'vertical') return 'header.paddingVertical';
           const directionCap = direction.charAt(0).toUpperCase() + direction.slice(1);
           return `header.padding${directionCap}`;
         }
         if (second === 'gap') return 'header.gap'; // Heading gap is often on root as CSS var
         return 'header.paddingHorizontal';
       }


       // heading.background-color -> header.backgroundColor
       if (last === 'background-color' || last === 'background') {
         return 'header.backgroundColor';
       }


       // heading.color, heading.font-size, etc. -> text.*
       return `text.${prop}`;
     }


     // Subheading properties (Redirect based on property type)
     if (top === 'subheading') {
       const prop = TokenMappingService.mapToComputedProperty(last);


       // subheading.color, subheading.font-* -> subHeading.* (capitalized)
       return `subHeading.${prop}`;
     }


     // SubHeading properties (note: capitalized, used in panel)
     if (top === 'subHeading') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `subHeading.${prop}`;
     }


     // Icon properties (icon.root.*, icon.text.*)
     if (top === 'icon') {
       const second = propertyPath[1];
       if (second === 'root' || second === 'text') {
         const prop = TokenMappingService.mapToComputedProperty(last);
         return `icon.${second}.${prop}`;
       }
       return `icon.${TokenMappingService.mapToComputedProperty(last)}`;
     }


     // ToggleIcon properties (toggleIcon.root.*)
     if (top === 'toggleIcon') {
       const second = propertyPath[1];
       if (second === 'root') {
         const prop = TokenMappingService.mapToComputedProperty(last);
         return `toggleIcon.root.${prop}`;
       }
       return `toggleIcon.${TokenMappingService.mapToComputedProperty(last)}`;
     }


     // Badge properties (color, marginRight, alignSelf)
     if (top === 'badge') {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `badge.${prop}`;
     }


     // Status/Variant properties (default, success, danger, warning, info, primary)
     const statusNamespaces = ['default', 'success', 'danger', 'warning', 'info', 'primary'];
     if (statusNamespaces.includes(top)) {
       const prop = TokenMappingService.mapToComputedProperty(last);
       return `${top}.${prop}`;
     }


     // Skeleton properties
     if (top === 'skeleton') {
       const second = propertyPath[1];
       if (second === 'root') {
         const prop = TokenMappingService.mapToComputedProperty(last);
         return `skeleton.root.${prop}`;
       }
       return `skeleton.${TokenMappingService.mapToComputedProperty(last)}`;
     }
   }


   // ============================================================================
   // FORM-WRAPPER-SPECIFIC MAPPINGS
   // ============================================================================
   const formWrapperNamespaces = [
     'background', 'body', 'footer', 'header', 'border', 'padding', 'margin'
   ];
   if (widget === 'form-wrapper' && formWrapperNamespaces.includes(top)) {
     const second = propertyPath[1];
     const third = propertyPath[2];
     const fourth = propertyPath[3];


     // 1. Header section mappings
     if (top === 'header') {
       // header.title.* -> title.text.*
       if (second === 'title') {
         if (third === 'font' && fourth) {
           const fullPropName = fourth === 'size' ? 'fontSize' :
             fourth === 'weight' ? 'fontWeight' :
               fourth === 'family' ? 'fontFamily' :
                 fourth;
           return `title.text.${fullPropName}`;
         }
         if (third === 'color') return 'title.text.color';
         if (third === 'margin') {
           const direction = fourth === 'horizontal' ? 'Left' : 'Top';
           return `title.text.margin${direction}`;
         }
       }
       // header.sub-title.* -> subheading.text.*
       if (second === 'sub-title') {
         if (third === 'font' && fourth) {
           const fullPropName = fourth === 'size' ? 'fontSize' :
             fourth === 'weight' ? 'fontWeight' :
               fourth === 'family' ? 'fontFamily' :
                 fourth;
           return `subheading.text.${fullPropName}`;
         }
         if (third === 'color') return 'subheading.text.color';
         if (third === 'margin') {
           const direction = fourth === 'horizontal' ? 'Left' : 'Top';
           return `subheading.text.margin${direction}`;
         }
       }
       // header.background -> heading.backgroundColor
       if (second === 'background') return 'heading.backgroundColor';
       // header.border.* -> heading.border*
       if (second === 'border') {
         if (third === 'color') return 'heading.borderColor';
         if (third === 'width') return 'heading.borderTopWidth';
         if (third === 'radius') return 'heading.borderTopLeftRadius';
         if (third === 'style') return 'heading.borderStyle';
       }
       // header.padding.* -> heading.padding*
       if (second === 'padding') {
         const direction = third === 'horizontal' ? 'Left' : 'Top';
         return `heading.padding${direction}`;
       }
     }


     // 2. Body section mappings
     if (top === 'body') {
       // body.background -> body.root.backgroundColor
       if (second === 'background') return 'body.root.backgroundColor';
       // body.border.* -> body.root.border*
       if (second === 'border') {
         if (third === 'color') return 'body.root.borderColor';
         if (third === 'width') return 'body.root.borderTopWidth';
         if (third === 'radius') return 'body.root.borderTopLeftRadius';
         if (third === 'style') return 'body.root.borderStyle';
       }
       // body.padding.* -> body.root.padding*
       if (second === 'padding') {
         const direction = third === 'horizontal' ? 'Left' : 'Top';
         return `body.root.padding${direction}`;
       }
     }


     // 3. Footer section mappings
     if (top === 'footer') {
       // footer.background -> footer.root.backgroundColor
       if (second === 'background') return 'footer.root.backgroundColor';
       // footer.border.* -> footer.root.border*
       if (second === 'border') {
         if (third === 'color') return 'footer.root.borderColor';
         if (third === 'width') return 'footer.root.borderTopWidth';
         if (third === 'radius') return 'footer.root.borderTopLeftRadius';
         if (third === 'style') return 'footer.root.borderStyle';
       }
       // footer.padding.* -> footer.root.padding*
       if (second === 'padding') {
         const direction = third === 'horizontal' ? 'Left' : 'Top';
         return `footer.root.padding${direction}`;
       }
     }


     // 4. Root-level properties
     if (top === 'background') return 'root.backgroundColor';
     if (top === 'border') {
       if (second === 'width') return 'root.borderTopWidth';
       if (second === 'radius') return 'root.borderTopLeftRadius';
       if (second === 'style') return 'root.borderStyle';
       if (second === 'color') return 'root.borderColor';
     }
     if (top === 'margin') return 'root.marginLeft'; // margin shorthand
     if (top === 'padding') return 'root.paddingTop'; // padding shorthand


     return `root.${TokenMappingService.mapToComputedProperty(last)}`;
   }


   // ============================================================================
   // FORM-CONTROLS-SPECIFIC MAPPINGS
   // ============================================================================
  const formControlsNamespaces = [
    'root', 'label', 'placeholder', 'floating', 'border', 'padding', 'margin', 'font', 'background', 'color', 'min-height', 'min-width', 'opacity'
  ];
  if (widget === 'formcontrols' && formControlsNamespaces.includes(top)) {
    const second = propertyPath[1];
    const third = propertyPath[2];
    const computedLast = TokenMappingService.mapToComputedProperty(last);


     // 1. Label properties -> text.* (Typography) or root.* (Layout)
     if (top === 'label') {
       let prop = computedLast;
       // label.font.* -> text.* (with full property names)
       if (second === 'font' && third) {
         const fullPropName = third === 'size' ? 'fontSize' :
           third === 'weight' ? 'fontWeight' :
             third === 'family' ? 'fontFamily' :
               third;
         return `text.${fullPropName}`;
       }
       // label.background -> text.backgroundColor
       if (second === 'background') {
         return 'root.backgroundColor';
       }
       // label.color -> text.color
       if (second === 'color') {
         return 'text.color';
       }
       // label.margin.horizontal -> root.marginLeft (as per user list)
       if (second === 'margin' && third === 'horizontal') {
         return 'root.marginLeft';
       }
       // label.margin.vertical -> root.marginTop (as per user list)
       if (second === 'margin' && third === 'vertical') {
         return 'root.marginTop';
       }
       return `text.${prop}`;
     }


    // 2. Placeholder properties -> placeholderText.color
    if (top === 'placeholder') {
      if (last === 'color') return 'placeholderText.color';
    }


     // 2b. Floating label properties -> floatingLabel.*
     if (top === 'floating') {
       if (second === 'font' && third) {
         const fullPropName = third === 'size' ? 'fontSize' :
           third === 'weight' ? 'fontWeight' :
             third === 'family' ? 'fontFamily' :
               third;
         return `floatingLabel.${fullPropName}`;
       }
       if (second === 'color') return 'floatingLabel.color';
       if (second === 'left') return 'floatingLabel.left';
       if (second === 'top') return 'floatingLabel.top';
       if (second === 'padding') return 'floatingLabel.padding';
       return `floatingLabel.${computedLast}`;
     }


     // 3. Border properties -> root.border*
     if (top === 'border') {
       if (second === 'radius') return 'root.borderTopLeftRadius';
       if (second === 'color') return 'root.borderColor';
       if (second === 'style') return 'root.borderStyle';
       if (second === 'width') return 'root.borderTopWidth';
       if (second && ['top', 'bottom', 'left', 'right'].includes(second) && third === 'width') {
         const direction = second.charAt(0).toUpperCase() + second.slice(1);
         return `root.border${direction}Width`;
       }
       if (last === 'radius') return 'root.borderTopLeftRadius';
     }


     // 4. Padding/Margin/Gap -> root.*
     if (top === 'padding' || top === 'margin' || top === 'gap') {
       if (second) {
         const direction = second.charAt(0).toUpperCase() + second.slice(1);
         return `root.${top}${direction}`;
       }
       if (top === 'gap') return 'content.gap';
       if (top === 'padding') return 'root.paddingTop';
       if (top === 'margin') return 'root.marginTop';
       return `root.${top}`;
     }


     // 5. Font properties -> text.* (Input field typography)
     if (top === 'font') {
       const fullPropName = last === 'size' ? 'fontSize' :
         last === 'weight' ? 'fontWeight' :
           last === 'family' ? 'fontFamily' :
             last;
       return `text.${fullPropName}`;
     }


     // 6. Root level properties
     let prop = computedLast;
     if (prop === 'background') {
       prop = 'backgroundColor';
       return `${prop}`;
     }
     if (prop === 'radius') prop = 'borderRadius';
     if (prop === 'height' || prop === 'min-height') prop = 'minHeight';
     if (prop === 'width' || prop === 'min-width') prop = 'minWidth';
     if (prop === 'color') return 'text.color';
     if (prop === 'opacity') return 'root.opacity';


     return `root.${prop}`;
   }


   // ============================================================================
   // NAVBAR-SPECIFIC MAPPINGS
   // ============================================================================
   const navbarNamespaces = [
     'anchor', 'back-icon', 'background-color', 'badge', 'button', 'content',
     'left-icon', 'menu-icon', 'popover-icon', 'height', 'image', 'padding'
   ];
   if (widget === 'navbar' && navbarNamespaces.includes(top)) {
     const second = propertyPath[1];
     const third = propertyPath[2];
     const fourth = propertyPath[3];


     // 1. Anchor section mappings
     if (top === 'anchor') {
       // anchor.icon.color -> leftnavIcon.icon.color
       if (second === 'icon' && third === 'color') {
         return 'leftnavIcon.icon.color';
       }
       // anchor.icon.size -> leftnavIcon.icon.fontSize
       if (second === 'icon' && third === 'size') {
         return 'leftnavIcon.icon.fontSize';
       }
       // anchor.text.color -> leftnavIcon.text.color (if exists, fallback to content)
       if (second === 'text' && third === 'color') {
         return 'content.color';
       }
       // anchor.text.font.* -> content.font*
       if (second === 'text' && third === 'font' && fourth) {
         const fullPropName = fourth === 'size' ? 'fontSize' :
           fourth === 'weight' ? 'fontWeight' :
             fourth === 'family' ? 'fontFamily' :
               fourth;
         return `content.${fullPropName}`;
       }
       // anchor.padding.* -> root.padding*
       if (second === 'padding' && third) {
         const direction = third.charAt(0).toUpperCase() + third.slice(1);
         return `root.padding${direction}`;
       }
     }


     // 2. Back icon mappings
     if (top === 'back-icon') {
       // back-icon.color -> backIcon.icon.color
       if (second === 'color') return 'backIcon.icon.color';
       // back-icon.size -> backIcon.icon.fontSize
       if (second === 'size') return 'backIcon.icon.fontSize';
     }


     // 3. Left icon mappings
     if (top === 'left-icon') {
       // left-icon.color -> leftnavIcon.icon.color
       if (second === 'color') return 'leftnavIcon.icon.color';
       // left-icon.size -> leftnavIcon.icon.fontSize
       if (second === 'size') return 'leftnavIcon.icon.fontSize';
     }


     // 4. Menu icon mappings
     if (top === 'menu-icon') {
       // menu-icon.color -> leftnavIcon.icon.color (menu icon uses same style)
       if (second === 'color') return 'leftnavIcon.icon.color';
       // menu-icon.size -> leftnavIcon.icon.fontSize
       if (second === 'size') return 'leftnavIcon.icon.fontSize';
     }


     // 5. Popover icon mappings
     if (top === 'popover-icon') {
       // popover-icon.color -> leftnavIcon.icon.color
       if (second === 'color') return 'leftnavIcon.icon.color';
       // popover-icon.size -> leftnavIcon.icon.fontSize
       if (second === 'size') return 'leftnavIcon.icon.fontSize';
     }


     // 6. Badge mappings
     if (top === 'badge') {
       // badge.background-color -> badge.backgroundColor
       if (second === 'background-color') return 'badge.backgroundColor';
       // badge.color -> badge.color
       if (second === 'color') return 'badge.color';
       // badge.margin-left -> badge.marginLeft
       if (second === 'margin-left') return 'badge.marginLeft';
     }


     // 7. Button mappings
     if (top === 'button') {
       // button.color -> content.color
       if (second === 'color') return 'content.color';
       // button.font.* -> content.font*
       if (second === 'font' && third) {
         const fullPropName = third === 'size' ? 'fontSize' :
           third === 'weight' ? 'fontWeight' :
             third === 'family' ? 'fontFamily' :
               third;
         return `content.${fullPropName}`;
       }
     }


     // 8. Content mappings
     if (top === 'content') {
       // content.color -> content.color
       if (second === 'color') return 'content.color';
       // content.font.* -> content.font*
       if (second === 'font' && third) {
         const fullPropName = third === 'size' ? 'fontSize' :
           third === 'weight' ? 'fontWeight' :
             third === 'family' ? 'fontFamily' :
               third;
         return `content.${fullPropName}`;
       }
     }


     // 9. Image mappings
     if (top === 'image') {
       if (second === 'height') return 'image.root.height';
       if (second === 'width') return 'image.root.width';
     }


     // 10. Root-level properties
     if (top === 'background-color') return 'root.backgroundColor';
     if (top === 'height') return 'root.height';
     if (top === 'padding') {
       if (second) {
         const direction = second.charAt(0).toUpperCase() + second.slice(1);
         return `root.padding${direction}`;
       }
       return 'root.paddingTop';
     }


     return `root.${TokenMappingService.mapToComputedProperty(last)}`;
   }


   // ============================================================================
   // PICTURE-SPECIFIC MAPPINGS
   // ============================================================================
   const pictureNamespaces = [
     'background', 'border', 'padding', 'radius'
   ];
   if (widget === 'picture' && pictureNamespaces.includes(top)) {
     const second = propertyPath[1];
     const third = propertyPath[2];


     // 1. Background -> root.backgroundColor
     if (top === 'background') return 'root.backgroundColor';


     // 2. Border mappings
     if (top === 'border') {
       // border.color -> root.borderColor
       if (second === 'color') return 'root.borderColor';
       // border.width -> root.borderWidth
       if (second === 'width') return 'root.borderTopWidth';
       // border.style -> root.borderStyle
       if (second === 'style') return 'root.borderStyle';
     }


     // 3. Padding mappings -> root.padding*
     if (top === 'padding') {
       if (second) {
         const direction = second.charAt(0).toUpperCase() + second.slice(1);
         return `root.padding${direction}`;
       }
       return 'root.paddingTop';
     }


     // 4. Radius -> root.borderRadius (and likely picture.borderRadius)
     // The doc shows radius maps to root.borderRadius AND picture.borderRadius.
     // We'll target root.borderRadius as the primary validation target.
     if (top === 'radius') return 'root.borderTopLeftRadius';


     return `root.${TokenMappingService.mapToComputedProperty(last)}`;
   }


   // ============================================================================
   // CAROUSEL-SPECIFIC MAPPINGS
   // ============================================================================
   if (widget === 'carousel') {
     let currentPath = propertyPath;
     let dotPrefix = 'dotStyle';
     let slidePrefix = 'slide';


     // Support active state mapping
     if (propertyPath[0] === 'states' && propertyPath[1] === 'active') {
       currentPath = propertyPath.slice(2);
       dotPrefix = 'activeDotStyle';
       slidePrefix = 'activeSlide';
     }


     const top = currentPath[0];
     const second = currentPath[1];
     const third = currentPath[2];
     const fourth = currentPath[3];


     // 1. Dots mappings -> dotStyle.* or dotsWrapperStyle.*
     if (top === 'dots') {
      // dots.wrapper.* -> dotsWrapperStyle.*
      if (second === 'wrapper') {
        if (third === 'background' && fourth === 'color') return 'dotsWrapperStyle.backgroundColor';
        if (third === 'padding') {
          if (fourth === 'top') return 'dotsWrapperStyle.paddingTop';
          if (fourth === 'bottom') return 'dotsWrapperStyle.paddingBottom';
          if (!fourth) return 'dotsWrapperStyle.paddingTop';
        }
        if (third === 'opacity') return 'dotsWrapperStyle.opacity';
      }
       // dots.* (excluding wrapper) -> dotStyle.* or activeDotStyle.*
       if (second === 'background') return `${dotPrefix}.backgroundColor`;
       if (second === 'border') {
         if (third === 'color') return `${dotPrefix}.borderColor`;
         if (third === 'width') return `${dotPrefix}.borderWidth`;
         if (third === 'radius') return `${dotPrefix}.borderRadius`;
         if (third === 'style') return `${dotPrefix}.borderStyle`;
       }
       if (second === 'radius') return `${dotPrefix}.borderRadius`;
      if (second === 'margin') {
        if (third === 'left') return `${dotPrefix}.marginLeft`;
        if (third === 'right') return `${dotPrefix}.marginRight`;
        if (!third) return 'activeDotStyle.margin';
      }
       if (second === 'opacity') return `${dotPrefix}.opacity`;
       if (second === 'height') return `${dotPrefix}.height`;
       if (second === 'width') return `${dotPrefix}.width`;
     }
     // 2. Navigation-arrows mappings -> prevBtn.root.* or prevBtn.icon.*
     if (top === 'navigation-arrows') {
       // navigation-arrows.background -> prevBtn.root.backgroundColor
       if (second === 'background') return 'prevBtn.root.backgroundColor';
       // navigation-arrows.border.* -> prevBtn.root.border*
       if (second === 'border') {
         if (third === 'color') return 'prevBtn.root.borderColor';
         if (third === 'width') return 'prevBtn.root.borderTopWidth';
         if (third === 'radius') return 'prevBtn.root.borderTopLeftRadius';
         if (third === 'style') return 'prevBtn.root.borderStyle';
       }
       // navigation-arrows.ripple.color -> prevBtn.root.rippleColor
       if (second === 'ripple' && third === 'color') return 'prevBtn.root.rippleColor';
       // navigation-arrows.color -> prevBtn.icon.color
       if (second === 'color') return 'prevBtn.icon.color';
       // navigation-arrows.font-size -> prevBtn.icon.fontSize
       if (second === 'font-size') return 'prevBtn.icon.fontSize';
       // navigation-arrows.height/width/margin-left -> prevBtn.root.*
       if (second === 'height') return 'prevBtn.root.height';
       if (second === 'width') return 'prevBtn.root.width';
       if (second === 'margin-left') return 'prevBtn.root.marginLeft';
       if (second === 'margin-right') return 'nextBtn.root.marginRight';
     }


     // 3. Ripple -> root.rippleColor
     if (top === 'ripple' && second === 'color') return 'root.rippleColor';


     // 4. Skeleton -> skeleton.root.width
     if (top === 'skeleton' && second === 'width') return 'skeleton.root.width';


    // 5. Slide -> slide.* or activeSlide.*
    if (top === 'slide') {
      if (second === 'padding' && third === 'horizontal') return `${slidePrefix}.paddingHorizontal`;
      if (second === 'padding' && !third) return 'slide.paddingTop';
      if (second === 'width') return `${slidePrefix}.width`;
    }


     return `root.${TokenMappingService.mapToComputedProperty(currentPath[currentPath.length - 1])}`;
   }


   // ============================================================================
   // BOTTOMSHEET-SPECIFIC MAPPINGS
   // ============================================================================
   if (widget === 'bottomsheet') {
     const prop = TokenMappingService.mapToComputedProperty(last);
     const second = propertyPath[1];
     const third = propertyPath[2];


     if (top === 'backdrop') return 'backdrop.backgroundColor';
     if (top === 'background') return 'container.backgroundColor';
    if (top === 'border') {
      if (second === 'color') return 'container.borderColor';
      if (second === 'radius') return 'container.borderTopLeftRadius';
      if (second === 'width') return 'container.borderBottomWidth';
      if (second === 'style') return 'container.borderStyle';
    }
     if (top === 'handle') {
       if (second === 'background') return 'dragHandleContainer.backgroundColor';
       if (second === 'border') {
         if (third === 'color') return 'dragHandleContainer.borderBottomColor';
         if (third === 'width') return 'dragHandleContainer.borderBottomWidth';
       }
       if (second === 'icon') {
         if (third === 'background') return 'dragIconHandle.backgroundColor';
         if (third === 'height') return 'dragIconHandle.height';
         if (third === 'width') return 'dragIconHandle.width';
       }
       if (second === 'padding') {
         if (!third) return 'dragHandleContainer.paddingTop';
         const direction = third.charAt(0).toUpperCase() + third.slice(1);
         return `dragHandleContainer.padding${direction}`;
       }
     }
    if (top === 'content' && second === 'padding') {
      if (!third) return 'sheetScrollContent.paddingTop';
      const direction = third.charAt(0).toUpperCase() + third.slice(1);
      return `sheetScrollContent.padding${direction}`;
    }
     if (top === 'margin') {
       if (!second) return 'container.marginLeft';
       const direction = second.charAt(0).toUpperCase() + second.slice(1);
       return `container.margin${direction}`;
     }
    if (top === 'radius') return 'container.borderTopLeftRadius';
    return `container.${prop}`;
  }


  // ============================================================================
  // BARCODESCANNER-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'barcodescanner') {
    const prop = TokenMappingService.mapToComputedProperty(last);
    const second = propertyPath[1];
    const third = propertyPath[2];


    if (top === 'background') return 'button.root.backgroundColor';
    if (top === 'border') {
      if (second === 'color') return 'button.root.borderColor';
      if (second === 'width') return 'button.root.borderTopWidth';
      if (second === 'radius') return 'button.root.borderTopLeftRadius';
      if (second === 'style') return 'button.root.borderStyle';
    }
    if (top === 'icon') {
      if (second === 'color') return 'button.icon.icon.color';
      if (second === 'font' && third === 'size') return 'button.icon.icon.fontSize';
    }
    if (top === 'ripple') return 'button.root.rippleColor';
    if (top === 'gap') return 'button.root.gap';
    if (top === 'text') {
      if (second === 'color') return 'button.text.color';
      if (second === 'font' && third === 'size') return 'button.text.fontSize';
      if (second === 'padding') {
        if (!third) return 'button.text.paddingTop';
        if (third === 'left') return 'button.text.paddingLeft';
      }
    }
    if (top === 'min') {
      if (second === 'height') return 'button.root.minHeight';
      if (second === 'width') return 'button.root.minWidth';
    }
    if (top === 'padding') {
      if (!second) return 'button.root.paddingTop';
      const direction = second.charAt(0).toUpperCase() + second.slice(1);
      return `button.root.padding${direction}`;
    }
    return `button.root.${prop}`;
  }

  // ============================================================================
  // CHIPS-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'chips') {
    let currentPath = propertyPath;
    let isActiveState = false;

    if (propertyPath[0] === 'states' && propertyPath[1] === 'active') {
      currentPath = propertyPath.slice(2);
      isActiveState = true;
    }

    const top = currentPath[0];
    const second = currentPath[1];
    const third = currentPath[2];
    const fourth = currentPath[3];
    const last = currentPath[currentPath.length - 1];
    const chipPrefix = isActiveState ? 'activeChip' : 'chip';
    const chipLabelPrefix = isActiveState ? 'activeChipLabel' : 'chipLabel';

    if (top === 'background-color') return `${chipPrefix}.backgroundColor`;
    if (top === 'color') return `${chipLabelPrefix}.color`;
    if (top === 'shadow') return `${chipPrefix}.boxShadow`;
    if (top === 'opacity') return 'root.opacity';

    if (top === 'border') {
      if (second === 'width') return `${chipPrefix}.borderWidth`;
      if (second === 'style') return `${chipPrefix}.borderStyle`;
      if (second === 'color') return `${chipPrefix}.borderColor`;
      if (second === 'radius') return `${chipPrefix}.borderRadius`;
    }

    if (top === 'item') {
      if (second === 'border') {
        if (third === 'color') return `${chipPrefix}.borderColor`;
        if (third === 'style') return `${chipPrefix}.borderStyle`;
        if (third === 'radius') return `${chipPrefix}.borderRadius`;
      }
      if (second === 'icon') {
        if (third === 'color') {
          return isActiveState
            ? 'activeChip.icon.color'
            : 'doneIcon.icon.color';
        }
        if (third === 'size') return 'doneIcon.icon.fontSize';
        if (third === 'gap') return 'doneIcon.icon.paddingLeft';
      }
      if (second === 'gap') return `${chipPrefix}.gap`;
      if (second === 'height') return `${chipPrefix}.height`;
      if (second === 'font-family') return `${chipPrefix}.fontFamily`;
      if (second === 'font-size') return `${chipPrefix}.fontSize`;
      if (second === 'font-weight') return `${chipPrefix}.fontWeight`;
      if (second === 'letter-spacing') return `${chipPrefix}.letterSpacing`;
      if (second === 'line-height') return `${chipPrefix}.lineHeight`;
      if (second === 'padding-bottom') return `${chipPrefix}.paddingBottom`;
      if (second === 'padding-left') return `${chipPrefix}.paddingLeft`;
      if (second === 'padding-right') return `${chipPrefix}.paddingRight`;
      if (second === 'padding-top') return `${chipPrefix}.paddingTop`;
      if (second === 'avatar') {
        if (third === 'size') return 'imageStyles.root.width';
        if (third === 'radius') return 'imageStyles.root.borderTopLeftRadius';
      }
    }

    if (top === 'list') {
      if (second === 'background-color') {
        return isActiveState
          ? 'activeChip.backgroundColor'
          : 'root.backgroundColor';
      }
      if (second === 'border') {
        if (third === 'color') {
          return isActiveState
            ? 'activeChip.borderColor'
            : 'root.borderColor';
        }
        if (third === 'width') return 'root.borderTopWidth';
        if (third === 'radius') return 'root.borderTopLeftRadius';
      }
      if (second === 'place' && third === 'holder' && (!fourth || fourth === 'color')) {
        return isActiveState
          ? 'activeChip.color'
          : 'search.placeholderText.color';
      }
      if (second === 'padding') return 'root.paddingTop';
      if (second === 'gap') return 'chipsWrapper.gap';
      if (second === 'height') return 'root.minHeight';
      if (second === 'padding-bottom') return 'root.paddingBottom';
      if (second === 'padding-left') return 'root.paddingLeft';
      if (second === 'padding-right') return 'root.paddingRight';
      if (second === 'padding-top') return 'root.paddingTop';
    }

    if (top === 'input') {
      if (second === 'padding') return 'search.text.paddingTop';
      if (second === 'padding-bottom') return 'inputchipwithicon.paddingBottom';
      if (second === 'padding-left') return 'inputchipwithicon.paddingLeft';
      if (second === 'padding-right') return 'inputchipwithicon.paddingRight';
      if (second === 'padding-top') return 'inputchipwithicon.paddingTop';
    }

    return `${chipPrefix}.${TokenMappingService.mapToComputedProperty(last)}`;
  }

  // ============================================================================
  // RADIOSET-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'radioset') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    if (top === 'border') {
      if (second === 'color') return 'uncheckedRadio.root.borderColor';
      if (second === 'width') return 'uncheckedRadio.root.borderTopWidth';
      if (second === 'radius') return 'uncheckedRadio.root.borderTopLeftRadius';
      if (second === 'style') return 'uncheckedRadio.root.borderStyle';
    }

    if (top === 'color') return 'root.color';

    if (top === 'label') {
      if (second === 'color') return 'radioLabel.color';
      if (second === 'font-family') return 'radioLabel.fontFamily';
      if (second === 'font-size') return 'radioLabel.fontSize';
      if (second === 'font-weight') return 'radioLabel.fontWeight';
      if (second === 'letter-spacing') return 'radioLabel.letterSpacing';
      if (second === 'line-height') return 'radioLabel.lineHeight';
    }

    if (top === 'title') {
      if (second === 'background' && third === 'color') return 'groupHeaderTitle.backgroundColor';
      if (second === 'color') return 'groupHeaderTitle.color';
      if (second === 'padding') {
        if (!third) return 'groupHeaderTitle.paddingTop';
        if (third === 'right') return 'groupHeaderTitle.paddingRight';
        if (third === 'left') return 'groupHeaderTitle.paddingLeft';
      }
      if (second === 'font' && third === 'family') return 'groupHeaderTitle.fontFamily';
      if (second === 'font' && third === 'size') return 'groupHeaderTitle.fontSize';
      if (second === 'line-height') return 'groupHeaderTitle.lineHeight';
    }

    if (top === 'gap') return 'radioLabel.marginLeft';

    if (top === 'indicator' && second === 'size') return 'checkedRadio.icon.fontSize';

    if (top === 'set' && second === 'item') {
      if (third === 'column' && fourth === 'gap') return 'item.marginRight';
      if (third === 'row' && fourth === 'gap') return 'item.marginTop';
    }

    if (top === 'size') return 'uncheckedRadio.root.width';

    return `root.${TokenMappingService.mapToComputedProperty(last)}`;
  }

  // ============================================================================
  // CHECKBOX-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'checkbox') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const isCheckedState = top === 'states' && second === 'checked';
    const activePropertyPath = isCheckedState ? propertyPath.slice(2) : propertyPath;
    const activeTop = activePropertyPath[0];
    const activeSecond = activePropertyPath[1];
    const activeThird = activePropertyPath[2];
    const iconPrefix = isCheckedState ? 'checkicon' : 'uncheckicon';

    if (activeTop === 'background' && activeSecond === 'color') {
      return `${iconPrefix}.root.backgroundColor`;
    }

    if (activeTop === 'border') {
      if (activeSecond === 'color') return `${iconPrefix}.root.borderColor`;
      if (activeSecond === 'width') return `${iconPrefix}.root.borderWidth`;
      if (activeSecond === 'radius') return `${iconPrefix}.root.borderRadius`;
    }

    if (activeTop === 'icon') {
      if (activeSecond === 'color') return `${iconPrefix}.icon.color`;
      if (activeSecond === 'size') return 'checkicon.icon.fontSize';
    }

    if (activeTop === 'label') {
      if (activeSecond === 'color') return 'selectedLabel.color';
      if (activeSecond === 'margin-left') return 'selectedLabel.marginLeft';
      if (activeSecond === 'font' && activeThird === 'family') return 'selectedLabel.fontFamily';
      if (activeSecond === 'font' && activeThird === 'size') return 'selectedLabel.fontSize';
    }

    if (activeTop === 'height') return `${iconPrefix}.root.height`;
    if (activeTop === 'width') return `${iconPrefix}.root.width`;

    return `${iconPrefix}.root.${TokenMappingService.mapToComputedProperty(activePropertyPath[activePropertyPath.length - 1])}`;
  }

  // ============================================================================
  // CHECKBOXSET-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'checkboxset') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];
    const isCheckedState = top === 'states' && second === 'checked';
    const activePropertyPath = isCheckedState ? propertyPath.slice(2) : propertyPath;
    const activeTop = activePropertyPath[0];
    const activeSecond = activePropertyPath[1];
    const activeThird = activePropertyPath[2];
    const activeFourth = activePropertyPath[3];
    const iconPrefix = isCheckedState ? 'checkicon' : 'uncheckicon';

    if (activeTop === 'background' && activeSecond === 'color') {
      return `${iconPrefix}.root.backgroundColor`;
    }

    if (activeTop === 'border') {
      if (activeSecond === 'color') return `${iconPrefix}.root.borderColor`;
      if (activeSecond === 'width') return `${iconPrefix}.root.borderWidth`;
      if (activeSecond === 'radius') return `${iconPrefix}.root.borderRadius`;
    }

    if (activeTop === 'icon') {
      if (activeSecond === 'color') return `${iconPrefix}.icon.color`;
      if (activeSecond === 'size') return 'checkicon.icon.fontSize';
    }

    if (activeTop === 'label') {
      if (activeSecond === 'color') return 'selectedLabel.color';
      if (activeSecond === 'margin' && activeThird === 'left') return 'selectedLabel.marginLeft';
      if (activeSecond === 'font' && activeThird === 'family') return 'selectedLabel.fontFamily';
      if (activeSecond === 'font' && activeThird === 'size') return 'selectedLabel.fontSize';
    }

    if (activeTop === 'title') {
      if (activeSecond === 'background' && activeThird === 'color') return 'groupHeaderTitle.backgroundColor';
      if (activeSecond === 'color') return 'groupHeaderTitle.color';
      if (activeSecond === 'padding' && activeThird === 'left') return 'groupHeaderTitle.paddingLeft';
      if (activeSecond === 'padding' && activeThird === 'right') return 'groupHeaderTitle.paddingRight';
      if (activeSecond === 'padding' && !activeThird) return 'groupHeaderTitle.paddingTop';
      if (activeSecond === 'font' && activeThird === 'family') return 'groupHeaderTitle.fontFamily';
      if (activeSecond === 'font' && activeThird === 'size') return 'groupHeaderTitle.fontSize';
    }

    if (activeTop === 'item' && activeSecond === 'margin') {
      if (activeThird === 'bottom') return 'item.marginBottom';
      if (activeThird === 'left') return 'item.marginLeft';
      if (activeThird === 'right') return 'item.marginRight';
      if (activeThird === 'top') return 'item.marginTop';
    }

    if (activeTop === 'height') return `${iconPrefix}.root.height`;
    if (activeTop === 'width') return `${iconPrefix}.root.width`;

    return `root.${TokenMappingService.mapToComputedProperty(activePropertyPath[activePropertyPath.length - 1])}`;
  }

  // ============================================================================
  // TOGGLE-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'toggle') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];

    if (top === 'background' && second === 'color') return 'root.backgroundColor';

    if (top === 'border') {
      if (second === 'color') return 'root.borderColor';
      if (second === 'radius') return 'root.borderTopLeftRadius';
      if (second === 'width') return 'root.borderTopWidth';
    }

    if (top === 'handle') {
      if (second === 'color') return 'handle.color';
      if (second === 'height') return 'handle.height';
      if (second === 'margin' && third === 'left') return 'handle.marginLeft';
      if (second === 'margin' && third === 'right') return 'handle.marginRight';
      if (second === 'radius') return 'handle.borderTopLeftRadius';
    }

    if (top === 'height') return 'root.height';
    if (top === 'width') return 'root.width';

    return `root.${TokenMappingService.mapToComputedProperty(last)}`;
  }

  // ============================================================================
  // SWITCH-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'switch') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    if (top === 'button') {
      if (second === 'background' && third === 'color') return 'button.backgroundColor';
      if (second === 'border') {
        if (third === 'color') return 'button.borderColor';
        if (third === 'radius') return 'firstButton.borderTopLeftRadius';
        if (third === 'width') return 'button.borderTopWidth';
      }
      if (second === 'color') return 'button.color';
      if (second === 'ripple' && third === 'color') return 'button.rippleColor';
      if (second === 'height') return 'button.height';
      if (second === 'padding' && third === 'left') return 'button.paddingLeft';
      if (second === 'padding' && third === 'right') return 'button.paddingRight';
      if (second === 'font') {
        if (third === 'family') return 'selectedButtonText.fontFamily';
        if (third === 'size') return 'selectedButtonText.fontSize';
        if (third === 'weight') return 'selectedButtonText.fontWeight';
      }
      if (second === 'text' && third === 'transform') return 'selectedButtonText.textTransform';
    }

    return `button.${TokenMappingService.mapToComputedProperty(last)}`;
  }

  // ============================================================================
  // WIZARD-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'wizard') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];
    const fifth = propertyPath[4];

    // Root level properties
    if (top === 'background' && second === 'color') return 'root.backgroundColor';
    if (top === 'border' && second === 'radius') return 'root.borderTopLeftRadius';
    if (top === 'box' && second === 'shadow') return 'root.boxShadow';
    if (top === 'padding-top') return 'root.paddingTop';
    if (top === 'padding-bottom') return 'root.paddingBottom';
    if (top === 'padding-left') return 'root.paddingLeft';
    if (top === 'padding-right') return 'root.paddingRight';
    
    if (top === 'gap') return 'root.gap';

    // Heading properties
    if (top === 'heading') {
      if (second === 'background' && third === 'color') return 'wizardHeader.backgroundColor';
      if (second === 'radius') return 'wizardHeader.borderTopLeftRadius';
      if (second === 'padding-top') return 'wizardHeader.paddingTop'
      if (second === 'padding-bottom') return 'wizardHeader.paddingBottom';
      if (second === 'padding-left') return 'wizardHeader.paddingLeft';
      if (second === 'padding-right') return 'wizardHeader.paddingRight';
    }
    // Step properties
    if (top === 'step') {
      // Step connector
      if (second === 'connector') {
        if (third === 'color') return 'stepConnector.backgroundColor';
        if (third === 'style') return 'stepConnector.borderStyle';
        if (third === 'width') return 'stepConnector.width';
      }

      // Step count/counter
      if (second === 'count') {
        if (third === 'color') return 'stepCounter.color';
        if (third === 'font-family')  return 'stepCounter.fontFamily';
          if (third === 'font-size') return 'stepCounter.fontSize';
          if (third === 'font-weight') return 'stepCounter.fontWeight';
        
        if (third === 'line-height') return 'stepCounter.lineHeight';
      }

      // Step description
      if (second === 'description') {
        if (third === 'color') return 'stepSubTitle.color';
        if (third === 'font-family')  return 'stepSubTitle.fontFamily';
          if (third === 'font-size') return 'stepSubTitle.fontSize';
          if (third === 'font-weight') return 'stepSubTitle.fontWeight';
        
        if (third === 'letter-spacing' ) return 'stepSubTitle.letterSpacing';
        if (third === 'line-height' ) return 'stepSubTitle.lineHeight';
      }

      // Step icon
      if (second === 'icon') {
        if (third === 'color') return 'stepIcon.text.color';
        if (third === 'size') return 'stepIcon.text.fontSize';
      }

      // Step indicator
      if (second === 'indicator') {
        if (third === 'background-color') return 'step.backgroundColor';
        if (third === 'border-color')  return 'step.borderColor';
          if (third === 'border-width') return 'step.borderTopWidth';
          if (third === 'border-radius') return 'step.borderTopLeftRadius';
          if (third === 'border-style') return 'step.borderStyle';
        
        if (third === 'size') return 'step.width';  // Also applies to height
      }

      // Step title
      if (second === 'title') {
        if (third === 'color') return 'stepTitle.color';
        if (third === 'font-family') 
         return 'stepTitle.fontFamily';
          if (third === 'font-size') return 'stepTitle.fontSize';
          if (third === 'font-weight') return 'stepTitle.fontWeight';
        
        if (third === 'letter-spacing') return 'stepTitle.letterSpacing';
        if (third === 'line-height' ) return 'stepTitle.lineHeight';
      }

      // Step gap
      if (second === 'gap') return 'step.gap';
    }

    // Body properties
    if (top === 'body') {
      if (second === 'height') return 'wizardBody.height';
      if (second === 'padding-top') return 'wizardBody.paddingTop';
      if (second === 'padding') return 'wizardBody.paddingTop';
    }

    // States - current state (activeStep)
    if (top === 'states' && second === 'current' && third === 'step') {
      if (fourth === 'description' && fifth === 'color') return 'activeStep.--wm-wizard-step-description-color';
      if (fourth === 'indicator') {
        if (fifth === 'background' && propertyPath[5] === 'color') return 'activeStep.backgroundColor';
        if (fifth === 'border' && propertyPath[5] === 'color') return 'activeStep.borderColor';
      }
    }

    // States - active state (doneStep)
    if (top === 'states' && second === 'active' && third === 'step') {
      if (fourth === 'icon' && fifth === 'color') return 'doneStep.color';
      if (fourth === 'count' && fifth === 'color') return 'doneStep.--wm-wizard-step-count-color';
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // CONTAINER-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'container') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    // Root level properties
    if (top === 'background' && second === 'color') return 'root.backgroundColor';
    if (top === 'border') {
      if (second === 'color') return 'root.borderColor';
      if (second === 'radius') return 'root.borderTopLeftRadius';
      if (second === 'style') return 'root.borderStyle';
      if (second === 'width') {
        if (third === 'top') return 'root.borderTopWidth';
        if (third === 'bottom') return 'root.borderBottomWidth';
        if (third === 'left') return 'root.borderLeftWidth';
        if (third === 'right') return 'root.borderRightWidth';
        return 'root.borderTopWidth';
      }
    }
    if (top === 'padding') {
      if (second === 'top') return 'root.paddingTop';
      if (second === 'bottom') return 'root.paddingBottom';
      if (second === 'left') return 'root.paddingLeft';
      if (second === 'right') return 'root.paddingRight';
    }
    if (top === 'box' && second === 'shadow') return 'root.boxShadow';
    if (top === 'opacity') return 'root.opacity';

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // TILE-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'tile') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];

    // Root level properties
    if (top === 'background' && second === 'color') return 'root.backgroundColor';
    if (top === 'color') return 'root.color';
    if (top === 'border') {
      if (second === 'color') return 'root.borderColor';
      if (second === 'radius') return 'root.borderTopLeftRadius';
      if (second === 'style') return 'root.borderStyle';
      if (second === 'width') return 'root.borderTopWidth';
    }
    if (top === 'padding') {
      if (second === 'top') return 'root.paddingTop';
      if (second === 'bottom') return 'root.paddingBottom';
      if (second === 'left') return 'root.paddingLeft';
      if (second === 'right') return 'root.paddingRight';
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // BUTTON-GROUP-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'button-group') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];

    // Root level properties
    if (top === 'border') {
      if (second === 'color') return 'root.borderColor';
      if (second === 'radius') return 'root.borderTopLeftRadius';
      if (second === 'style') return 'root.borderStyle';
      if (second === 'width') return 'root.borderTopWidth';
    }
    if (top === 'radius') return 'root.borderTopLeftRadius';

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // ANCHOR-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'anchor') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];
    const pathStr = propertyPath.join('.');

    // Root level properties
    if (top === 'color' && second === '@') return 'root.color';
    if (top === 'gap') return 'root.gap';

    // Icon properties
    if (top === 'icon') {
      if (second === 'size') return 'icon.icon.fontSize';
    }

    // Image properties
    if (top === 'image') {
      if (second === 'size') return 'icon.image.width';  // Also applies to height
      if (second === 'radius') return 'icon.image.borderTopLeftRadius';
    }

    // Font properties
    if (pathStr === 'font-family') return 'text.fontFamily';
    if (pathStr === 'font-size') return 'text.fontSize';
    if (pathStr === 'font-weight') return 'text.fontWeight';
    if (pathStr === 'line-height') return 'text.lineHeight';
    if (pathStr === 'letter-spacing') return 'text.letterSpacing';

    if (top === 'font') {
      if (second === 'family') return 'text.fontFamily';
      if (second === 'size') return 'text.fontSize';
      if (second === 'weight') return 'text.fontWeight';
    }
    if (top === 'letter' && second === 'spacing') return 'text.letterSpacing';
    if (top === 'line' && second === 'height') return 'text.lineHeight';
    if (top === 'text' && second === 'transform') return 'text.textTransform';

    // Text decoration
    if (top === 'text' && second === 'decoration' && third === '@') return 'text.textDecorationLine';
    
    // Text padding
    if (top === 'text' && second === 'padding' && third) {
      if (third === 'left') return 'text.paddingLeft';
      if (third === 'right') return 'text.paddingRight';
      if (third === 'top') return 'text.paddingTop';
      if (third === 'bottom') return 'text.paddingBottom';
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // WEBVIEW-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'webview') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];

    // Container properties
    if (top === 'container') {
      if (second === 'min' && third === 'height') return 'container.minHeight';
      if (second === 'height') return 'container.minHeight';
    }

    if (top === 'background' && second === 'color') return 'root.backgroundColor';

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // SPINNER-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'spinner') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    // Root level properties
    if (top === 'background') return 'root.backgroundColor';
    if (top === 'width') return 'root.width';

    // Icon properties
    if (top === 'icon') {
      if (second === 'color') return 'icon.icon.color';
      if (second === 'size') return 'icon.icon.fontSize';
    }

    // Text properties
    if (top === 'text') {
      if (second === 'color') return 'text.color';
      if (second === 'padding' && third === 'left') return 'text.paddingLeft';
      if (second === 'font' && third === '-size') return 'text.fontSize';
    }

    // Lottie properties
    if (top === 'lottie') {
      if (second === 'height') return 'lottie.height';
      if (second === 'width') return 'lottie.width';
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // SEARCH-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'search') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];
    const fifth = propertyPath[4];

    // Root level properties
    if (top === 'height') return 'searchButton.root.height';
    if (top === 'border') {
      if (second === 'color') return 'dropDownContent.borderColor';
      if (second === 'width') return 'dropDownContent.borderTopWidth';
      if (second === 'radius') return 'root.borderTopLeftRadius';
    }

    // Button properties
    if (top === 'btn') {
      if (second === 'background' && third === 'color') return 'searchButton.root.backgroundColor';
      if (second === 'icon') {
        if (third === 'color') return 'searchButton.icon.icon.color';
        if (third === 'size') return 'searchButton.icon.icon.fontSize';
      }
      if (second === 'ripple' && third === 'color') return 'searchButton.root.rippleColor';
      if (second === 'padding') return 'searchButton.root.paddingTop';
      if (second === 'width') return 'searchButton.root.width';
    }
    if(top=== 'invalid' && second==='color') return 'invalid.borderColor'

    // Data complete properties
    if (top === 'data-complete') {
      if (second === 'background') return 'dataCompleteItem.root.backgroundColor';
      if (second === 'text') {
        if (third === 'color') return 'dataCompleteItem.text.color';
        if (third === 'font') {
          if (fourth === 'family') return 'dataCompleteItem.text.fontFamily';
          if (fourth === 'size') return 'dataCompleteItem.text.fontSize';
          if (fourth === 'weight') return 'dataCompleteItem.text.fontWeight';
        }
      }
      if (second === 'padding') {
        if (!third) return 'dataCompleteItem.root.paddingTop';
        if (third === 'top') return 'dataCompleteItem.root.paddingTop';
        if (third === 'bottom') return 'dataCompleteItem.root.paddingBottom';
        if (third === 'left') return 'dataCompleteItem.root.paddingLeft';
        if (third === 'right') return 'dataCompleteItem.root.paddingRight';
      }
    }

    // Dropdown properties
    if (top === 'dropdown') {
      if (second === 'background' && third === 'color') return 'dropDownContent.backgroundColor';
      if (second === 'border') {
        if (third === 'color') return 'dropDownContent.borderColor';
        if (third === 'width') return 'dropDownContent.borderTopWidth';
        if (third === 'radius') return 'dropDownContent.borderTopLeftRadius';
      }
      if (second === 'width') return 'dropDownContent.width';
    }

    // Item properties
    if (top === 'item') {
      if (second === 'separator') {
        if (third === 'color') return 'searchItem.borderBottomColor';
        if (third === 'width') return 'searchItem.borderBottomWidth';
      }
      if (second === 'text') {
        if (third === 'color') return 'searchItemText.color';
        if (third === 'font') {
          if (fourth === 'family') return 'searchItemText.fontFamily';
          if (fourth === 'size') return 'searchItemText.fontSize';
          if (fourth === 'weight') return 'searchItemText.fontWeight';
        }
      }
      if (second === 'margin-bottom' ) return 'searchItem.marginBottom';
      if (second === 'padding') {
        if (third === 'top') return 'searchItem.paddingTop';
        if (third === 'bottom') return 'searchItem.paddingBottom';
        if (third === 'left') return 'searchItem.paddingLeft';
        if (third === 'right') return 'searchItem.paddingRight';
        if (!third) return 'searchItem.paddingTop';
      }
    }

    // Placeholder properties
    if (top === 'placeholder' && second === 'text' && third === 'color') {
      return 'placeholderText.color';
    }

    // Clear button properties
    if (top === 'clear-btn') {
      if (second === 'background' && third === 'color') return 'clearButton.root.backgroundColor';
      if (second === 'border' && third === 'radius') return 'clearButton.root.borderTopLeftRadius';
      if (second === 'icon') {
        if (third === 'color') return 'clearButton.icon.icon.color';
        if (third === 'size') return 'clearButton.icon.icon.fontSize';
      }
      if (second === 'padding') return 'clearButton.root.paddingTop';
      if (second === 'width') return 'clearButton.root.width';
    }

    // Text input properties
    if (top === 'text') {
      if (second === 'background' && third === 'color') return 'text.backgroundColor';
      if (second === 'color') return 'searchItemText.color';
      if (second === 'padding') {
        if (third === 'top') return 'text.paddingTop';
        if (third === 'bottom') return 'text.paddingBottom';
        if (third === 'left') return 'text.paddingLeft';
      }
      if (second === 'font') {
        if (third === 'family') return 'searchItemText.fontFamily';
        if (third === 'size') return 'searchItemText.fontSize';
        if (third === 'weight') return 'searchItemText.fontWeight';
      }
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // PROGRESS-BAR-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'progress-bar') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];
    const fifth = propertyPath[4];

    // Background properties
    if (top === 'background') {
      if (second === 'active') return 'progressValue.backgroundColor';
      if (second === 'inactive') return 'progressBar.backgroundColor';
    }

    // Tooltip properties
    if (top === 'tooltip') {
      if (second === 'background') return 'tooltip.backgroundColor';
      if (second === 'label') {
        if (third === 'color') return 'tooltipLabel.color';
        if (third === 'size') return 'tooltipLabel.fontSize';
      }
      if (second === 'triangle' && third === 'border' && fourth === 'bottom' && fifth === 'color') {
        return 'tooltipTriangle.borderBottomColor';
      }
      if (second === 'triangle' && third === 'border' && fourth === 'bottom-color') {
        return 'tooltipTriangle.borderBottomColor';
      }
      if (second === 'padding') {
        if (third === 'horizontal') return 'tooltip.paddingLeft';  // Also applies to paddingRight
        if (third === 'vertical') return 'tooltip.paddingTop';  // Also applies to paddingBottom
      }
      if (second === 'border' && third === 'radius') return 'tooltip.borderTopLeftRadius';
    }

    // Root level properties
    if (top === 'height') return 'progressBar.height';
    if (top === 'margin') return 'progressBar.margin';
    if (top === 'radius') return 'progressBar.borderTopLeftRadius';  // Also applies to other border radius properties

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // PROGRESS-CIRCLE-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'progress-circle') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    // Stroke properties
    if (top === 'stroke') {
      if (second === 'active') return 'progressValue.stroke';
      if (second === 'inactive') return 'progressCircle.stroke';
    }

    // Sub-title properties
    if (top === 'sub-title') {
      if (second === 'color') return 'subTitle.color';
      if (second === 'font') {
        if (third === 'family') return 'subTitle.fontFamily';
        if (third === 'size') return 'subTitle.fontSize';
      }
    }

    // Size properties
    if (top === 'height') return 'root.height';
    if (top === 'width') return 'root.width';

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // DROPDOWN-MENU-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'dropdown-menu') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    // Menu properties
    if (top === 'menu') {
      if (second === 'background') return 'root.backgroundColor';
      if (second === 'border') {
        if (third === 'color') return 'root.borderColor';
        if (third === 'width') return 'root.borderTopWidth';
        if (third === 'radius') return 'root.borderTopLeftRadius';
      }
      if (second === 'caret') {
        if (third === 'color') return 'link.icon.icon.color';
        if (third === 'size') return 'link.icon.icon.fontSize';
      }
      if (second === 'color') return 'link.text.color';
      if (second === 'text' && third === 'font-weight') return 'link.text.fontWeight';
      if (second === 'content') {
        if (third === 'background') return 'menu.backgroundColor';
        if (third === 'width') return 'menu.width';
        if (third === 'border' && fourth === 'radius') return 'menu.borderTopLeftRadius';
      }
      if (second === 'item') {
        if (third === 'color') return 'menuItem.text.color';
        if (third === 'font-weight') return 'menuItem.text.fontWeight';
        if (third === 'font-family') return 'menuItem.text.fontFamily';
        if (third === 'font-size') return 'menuItem.text.fontSize';
        if (third === 'line-height') return 'menuItem.text.lineHeight';
        if (third === 'padding') {
          if (fourth === 'top') return 'menuItem.root.paddingTop';
          if (fourth === 'bottom') return 'menuItem.root.paddingBottom';
          if (fourth === 'left') return 'menuItem.root.paddingLeft';
          if (fourth === 'right') return 'menuItem.root.paddingRight';
          if (!fourth) return 'menuItem.root.paddingTop';
        }
        if (third === 'font') {
          if (fourth === 'family') return 'menuItem.text.fontFamily';
          if (fourth === 'size') return 'menuItem.text.fontSize';
          if (fourth === 'weight') return 'menuItem.text.fontWeight';
        }
        if (third === 'line' && fourth === 'height') return 'menuItem.text.lineHeight';
        if (third === 'border' && fourth === 'style') return 'menuItem.root.borderStyle';
      }
      if (second === 'icon' && third === 'size') return 'menuItem.icon.icon.fontSize';
      if (second === 'padding') {
        if (third === 'top') return 'menu.paddingTop';
        if (third === 'bottom') return 'menu.paddingBottom';
        if (third === 'left') return 'menu.paddingLeft';
        if (third === 'right') return 'menu.paddingRight';
        if (!third) return 'menu.paddingTop';
      }
      if (second === 'text') {
        if (third === 'padding') {
          if (fourth === 'left') return 'link.text.paddingLeft';
          if (fourth === 'right') return 'link.text.paddingRight';
          if (!fourth) return 'link.text.paddingTop';
        }
        if (third === 'font' && fourth === 'weight') return 'link.text.fontWeight';
        if (third === 'decoration') return 'link.text.textDecoration';
      }
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // POPOVER-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'popover') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    // Root level properties
    if (top === 'background-color') return 'popover.backgroundColor';
    if (top === 'padding') return 'popover.paddingTop';
    if(top === 'padding-top') return 'popover.paddingTop';
    if(top === 'padding-bottom') return 'popover.paddingBottom';
    if(top === 'padding-left') return 'popover.paddingLeft';
    if(top === 'padding-right') return 'popover.paddingRight';
    if (top === 'elevation') return platform === 'android' ? 'popover.elevation' : 'popover.boxShadow';
    if (top === 'shadow') return 'popover.boxShadow';
    if (top === 'width') return 'popover.width';
    if (top === 'min-height' || (top === 'min' && second === 'height')) return 'popover.minHeight';
    if (top === 'position') return 'popover.position';
    if (top === 'bottom') return 'popover.bottom';
    if (top === 'left') return 'popover.left';
    if(top === 'border-top-left-radius') return 'popover.borderTopLeftRadius';
    if(top === 'border-top-right-radius') return 'popover.borderTopRightRadius';

    // Border properties
    if (top === 'border') {
      if (second === 'radius') return 'popover.borderTopLeftRadius';
      if (second === 'color') return 'popover.borderColor';
      if (second === 'width') return 'popover.borderTopWidth';
      if (second === 'style') return 'popover.borderStyle';
    }

    // Content properties
    if (top === 'content') {
      if (second === 'background-color') return 'popoverContent.root.backgroundColor';
      if (second === 'border') {
        if (third === 'radius') return 'popoverContent.root.borderTopLeftRadius';
        if (third === 'color') return 'popoverContent.root.borderColor';
        if (third === 'width') return 'popoverContent.root.borderTopWidth';
        if (third === 'style') return 'popoverContent.root.borderStyle';
      }
      if (second === 'shadow') return 'popoverContent.root.boxShadow';
    }

    // Modal properties
    if (top === 'modal' && second === 'content' && third === 'shadow') return 'modalContent.boxShadow';

    // Header properties
    if (top === 'header') {
      if (second === 'background-color') return 'title.backgroundColor';
      if (second === 'color') return 'title.color';
      // if (second === 'padding') {
      //   if (third === '-top') return 'title.paddingTop';
      //   if (third === '-bottom') return 'title.paddingBottom';
      //   if (third === '-left') return 'title.paddingLeft';
      //   if (third === '-right') return 'title.paddingRight';
      // }
      if(second === 'padding') return 'title.paddingTop';
      if(second === 'padding-top') return 'title.paddingTop';
      if(second === 'padding-bottom') return 'title.paddingBottom';
      if(second === 'padding-left') return 'title.paddingLeft';
      if(second === 'padding-right') return 'title.paddingRight';
      // if (second === 'font') {
      //   if (third === '-family') return 'title.fontFamily';
      //   if (third === '-size') return 'title.fontSize';
      //   if (third === '-weight') return 'title.fontWeight';
      // }
      if(second === 'font-family') return 'title.fontFamily';
      if(second === 'font-size') return 'title.fontSize';
      if(second === 'font-weight') return 'title.fontWeight';
      if (second === 'letter-spacing') return 'title.letterSpacing';
      if (second === 'line-height') return 'title.lineHeight';
    }

    // Link properties
    if (top === 'link') {
      if (second === 'background' && third === 'color') return 'root.backgroundColor';
      if (second === 'border') {
        if (third === 'color') return 'root.borderColor';
        if (third === 'width') return 'root.borderTopWidth';
        if(third === 'style') return 'root.borderStyle';
        if(third === 'radius') return 'root.borderTopLeftRadius';
      }
      if (second === 'color') return 'link.text.color';
      if (second === 'text-decoration') return 'link.text.textDecoration';
      if (second === 'icon') {
        if (third === 'color') return 'link.icon.icon.color';
        if (third === 'size') return 'link.icon.icon.fontSize';
      }
      if (second === 'padding') {
        if (third === 'top') return 'root.paddingTop';
        if (third === 'bottom') return 'root.paddingBottom';
        if (third === 'left') return 'root.paddingLeft';
        if (third === 'right') return 'root.paddingRight';
        return 'root.paddingTop';
      }
      if(second === 'padding-top') return 'root.paddingTop';
      if(second === 'padding-bottom') return 'root.paddingBottom';
      if(second === 'padding-left') return 'root.paddingLeft';
      if(second === 'padding-right') return 'root.paddingRight';
      // if(second === 'font') {
      //   if (third === '-family') return 'link.text.fontFamily';
      //   if (third === '-size') return 'link.text.fontSize';
      //   if (third === '-weight') return 'link.text.fontWeight';
      // }
      if(second === 'font-family') return 'link.text.fontFamily';
      if(second === 'font-size') return 'link.text.fontSize';
      if(second === 'font-weight') return 'link.text.fontWeight';
      if (second === 'letter-spacing') return 'link.text.letterSpacing';
      if (second === 'line-height') return 'link.text.lineHeight';
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }

  // ============================================================================
  // LOGIN-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'login') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];

    // Error properties
    if (top === 'error') {
      if (second === 'background' && third === 'color') return 'errorMsgStyles.backgroundColor';
      if (second === 'border') {
        if (third === 'color') return 'errorMsgStyles.borderColor';
        if (third === 'radius') return 'errorMsgStyles.borderTopLeftRadius';
      }
      if (second === 'text' && third === 'color') return 'errorMsgStyles.color';
    }

    // Form properties
    if (top === 'form') {
      if (second === 'padding') {
        if (third === 'top') return 'formStyles.paddingTop';
        if (third === 'bottom') return 'formStyles.paddingBottom';
        if (third === 'left') return 'formStyles.paddingLeft';
        if (third === 'right') return 'formStyles.paddingRight';
        if (!third) return 'formStyles.paddingTop';
      }
    }

    return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
  }


  // ============================================================================
  // TABS-SPECIFIC MAPPINGS
  // ============================================================================
   if (widget === 'tabs') {
     let currentPath = propertyPath;
     let labelPrefix = 'tabLabel';
     let iconPrefix = 'tabIcon.icon';
     let itemPrefix = 'tabItem';
     let indicatorPrefix = 'tabIndicator';


     // Support active state mapping
     if (propertyPath[0] === 'states' && propertyPath[1] === 'active') {
       currentPath = propertyPath.slice(2);
       labelPrefix = 'activeTabLabel';
       iconPrefix = 'activeTabIcon.icon';
       itemPrefix = 'activeTabItem';
       indicatorPrefix = 'activeTabIndicator';
     }


     const top = currentPath[0];
     const second = currentPath[1];
     const third = currentPath[2];
     const fourth = currentPath[3];


     // 1. Root properties
     if (top === 'background') return 'root.backgroundColor';
     if (top === 'border') {
       if (second === 'color') return 'root.borderColor';
       if (second === 'width') return 'root.borderTopWidth';
       if (second === 'radius') return 'root.borderTopLeftRadius';
       if (second === 'style') return 'root.borderStyle';
     }
     if (top === 'min' && second === 'height') return 'root.minHeight';
     if (top === 'radius') return 'root.borderTopLeftRadius';


     // 2. Heading (tabHeader & tabheaderdivider)
     if (top === 'heading') {
       if (second === 'background') return 'tabHeader.backgroundColor';
       if (second === 'border') {
         if (third === 'color') return 'tabheaderdivider.borderBottomColor';
         if (third === 'width') return 'tabheaderdivider.borderBottomWidth';
         if (third === 'radius') return 'tabHeader.borderTopLeftRadius';
         if (third === 'style') return 'tabHeader.borderStyle';
       }
     }


     // 3. Item Heading (Item)
     if (top === 'item' && second === 'heading') {
       if (third === 'background') return `${itemPrefix}.backgroundColor`;
       if (third === 'text' && fourth === 'color') return `${labelPrefix}.color`;
       if (third === 'padding') return `${itemPrefix}.padding`;

       // Icon
       if (third === 'icon') {
         if (fourth === 'color') return `${iconPrefix}.color`;
         if (fourth === 'size') return `${iconPrefix}.fontSize`;
         return `${iconPrefix}.${fourth}`;
       }

       // Border
       if (third === 'border') {
         if (fourth === 'color') return `${itemPrefix}.borderColor`;
         if (fourth === 'width') return `${itemPrefix}.borderTopWidth`;
         if (fourth === 'radius') return `${itemPrefix}.borderTopLeftRadius`;
         if (fourth === 'style') return `${itemPrefix}.borderStyle`;
       }

       // Indicator
       if (third === 'indicator') {
         if (fourth === 'background') return `${indicatorPrefix}.backgroundColor`;
         if (fourth === 'height') return `${indicatorPrefix}.height`;
         if (fourth === 'margin') return `${indicatorPrefix}.marginTop`;
       }

       // Font/Text
       if (third === 'font') {
         if (fourth === 'size') return `${labelPrefix}.fontSize`;
         if (fourth === 'weight') return `${labelPrefix}.fontWeight`;
         if (fourth === 'family') return `${labelPrefix}.fontFamily`;
       }
       if (third === 'line-height') return `${labelPrefix}.lineHeight`;
     }


     // 4. Icon
     if (top === 'icon') {
       if (second === 'font' && third === 'size') return `${iconPrefix}.fontSize`;
     }


     // Fallback
     return `root.${TokenMappingService.mapToComputedProperty(currentPath[currentPath.length - 1])}`;
   }


   // ============================================================================
   // LIST-SPECIFIC MAPPINGS
   // ============================================================================
   if (widget === 'list') {
     const top = propertyPath[0];
     const second = propertyPath[1];


     // 1. Root properties
     if (top === 'background') return 'root.backgroundColor';
     if (top === 'border') {
       if (second === 'color') return 'root.borderColor';
       if (second === 'width') return 'root.borderTopWidth';
       if (second === 'radius') return 'root.borderTopLeftRadius';
       if (second === 'style') return 'root.borderStyle';
     }
     if (top === 'padding') {
       if (second === 'top') return 'root.paddingTop';
       if (second === 'bottom') return 'root.paddingBottom';
       if (second === 'left') return 'root.paddingLeft';
       if (second === 'right') return 'root.paddingRight';
     }


     // Fallback
     return `root.${TokenMappingService.mapToComputedProperty(propertyPath[propertyPath.length - 1])}`;
   }




   // ============================================================================
   // TABBAR-SPECIFIC MAPPINGS
   // ============================================================================
   if (widget === 'tabbar') {
     let currentPath = propertyPath;
     let labelPrefix = 'tabLabel';
     let iconPrefix = 'tabIcon.icon';
     let itemPrefix = 'tabItem';


     // Support active state mapping
     if (propertyPath[0] === 'states' && propertyPath[1] === 'active') {
       currentPath = propertyPath.slice(2);
       labelPrefix = 'activeTabLabel';
       iconPrefix = 'activeTabIcon.icon';
       itemPrefix = 'activeTabItem';
     }


     const top = currentPath[0];
     const second = currentPath[1];
     const third = currentPath[2];
     const fourth = currentPath[3];


     // 1. Root & Base properties
     if (top === 'height') return 'root.height';
     if (top === 'box-shadow') return 'root.boxShadow';
    if (top === 'border') {
      if (second === 'top') {
        if (third === 'color') return 'root.borderTopColor';
        if (third === 'width') return 'root.borderTopWidth';
        if (third === 'style') return 'root.borderTopStyle';
      }
      if (second === 'color') return 'root.borderColor';
      if (second === 'width') return 'root.borderTopWidth';
      if (second === 'style') return 'root.borderStyle';
    }


     // 2. Icon mappings
     if (top === 'icon') {
       if (second === 'border-bottom-color') return 'tabIcon.root.borderBottomColor';
       if (second === 'color') return `${iconPrefix}.color`;
       if (second === 'size') return `${iconPrefix}.fontSize`;
       if (second === 'padding') {
         if (!third) return 'tabIcon.root.paddingTop';
         if (third === 'bottom') return 'tabIcon.root.paddingBottom';
         if (third === 'right') return `${iconPrefix}.paddingRight`;
       }
     }


     // 3. Item mappings
     if (top === 'item') {
       if (second === 'background' && third === 'color') return `${itemPrefix}.backgroundColor`;
       if (second === 'min') {
         if (third === 'height') return 'tabItem.minHeight';
         if (third === 'width') return 'tabItem.minWidth';
       }
       if (second === 'opacity') return `${itemPrefix}.opacity`;
      if (second === 'border') {
        if (third === 'radius') return `${itemPrefix}.borderTopLeftRadius`;
        if (third === 'width') return `${itemPrefix}.borderTopWidth`;
      }
    }


     // 4. Menu & More-Menu mappings
     if (top === 'menu') {
       if (second === 'background') return 'menu.backgroundColor';
       if (second === 'height') return 'menu.height';
     }
     if (top === 'more-menu') {
       if (second === 'background') return 'moreMenu.backgroundColor';
       if (second === 'width') return 'moreMenu.width';
       if (second === 'box-shadow') return 'moreMenu.boxShadow';
     }
     if (top === 'more-menu-row') {
       if (second === 'padding') {
         if (!third) return 'moreMenuRow.paddingTop';
         if (third === 'bottom') return 'moreMenuRow.paddingBottom';
         if (third === 'top') return 'moreMenuRow.paddingTop';
       }
       if (second === 'width') return 'moreMenuRow.width';
     }


     // 5. Text / Label mappings
     if (top === 'text') {
       if (second === 'color') return `${labelPrefix}.color`;
       if (second === 'margin' && third === 'top') return 'tabLabel.marginTop';
       if (second === 'font') {
         if (third === 'family') return `${labelPrefix}.fontFamily`;
         if (third === 'size') return `${labelPrefix}.fontSize`;
         if (third === 'weight') return `${labelPrefix}.fontWeight`;
       }
     }


    return `root.${TokenMappingService.mapToComputedProperty(currentPath[currentPath.length - 1])}`;
  }

  // ============================================================================
  // CALENDAR-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'calendar') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];
    const pathStr = propertyPath.join('.');

    if (pathStr === 'width') return 'root.width';
    if (pathStr === 'min-height') return 'root.minHeight';

    if (top === 'view') {
      if (second === 'border' && third === 'width') return 'calendar.borderTopWidth';
      if (second === 'border' && third === 'style') return 'calendar.borderStyle';
      if (second === 'radius') return 'calendar.borderTopLeftRadius';
      if (second === 'shadow') return platform === 'android' ? 'calendar.elevation' : 'calendar.boxShadow';
    }

    if (top === 'header') {
      if (second === 'background-color') return 'calendarHeader.backgroundColor';
      if (second === 'border' && third === 'bottom-width') return 'calendarHeader.borderBottomWidth';
      if (second === 'border' && third === 'style') return 'calendarHeader.borderStyle';
      if (second === 'border' && third === 'color') return 'calendarHeader.borderColor';
      if (second === 'border' && third === 'radius') return 'calendarHeader.borderTopLeftRadius';
      if (second === 'border' && third === 'width') return 'calendarHeader.borderTopWidth';
      if (second === 'padding') return 'calendarHeader.paddingTop';
    }

    if (top === 'weekday') {
      if (second === 'padding') return 'weekDay.paddingTop';
      if (second === 'background-color') return 'weekDay.backgroundColor';
      if (second === 'border' && third === 'bottom-width') return 'weekDay.borderBottomWidth';
      if (second === 'border' && third === 'style') return 'weekDay.borderStyle';
      if (second === 'border' && third === 'color') return 'weekDay.borderColor';
      if (second === 'border' && third === 'width') return 'weekDay.borderTopWidth';
      if (second === 'text' && third === 'color') return 'weekDayText.color';
      if (second === 'text' && third === 'font-family') return 'weekDayText.fontFamily';
      if (second === 'text' && third === 'font-size') return 'weekDayText.fontSize';
      if (second === 'text' && third === 'font-weight') return 'weekDayText.fontWeight';
    }

    if (top === 'fc' && second === 'header') {
      if (third === 'horizontal-padding') return 'calendarHeader.paddingLeft';
      if (third === 'vertical-padding') return 'calendarHeader.paddingTop';
      if (third === 'text-font-weight') return 'monthText.fontWeight';
    }

    if (pathStr === 'fc.events-gap') return 'calendar.eventsGap';

    if (top === 'fc' && second === 'button') {
      if (third === 'bg-color') return 'prevMonthBtn.root.backgroundColor';
      if (third === 'border-color') return 'prevMonthBtn.root.borderColor';
    }

    if (pathStr === 'day-border-color') return 'day.borderColor';

    if (top === 'event-day1') {
      if (second === 'color1') return 'eventDay1.color';
      if (second === 'color2') return 'eventDay2.color';
      if (second === 'color3') return 'eventDay3.color';
    }

    if (top === 'fc') {
      if (second === 'anchor-color') return 'weekDayText.color';
      if (second === 'event' && third === 'background') return 'selectedDayText.backgroundColor';
      if (second === 'event' && third === 'color') return 'selectedDayText.color';
      if (second === 'event' && third === 'today' && fourth === 'background') return 'today.backgroundColor';
      if (second === 'event' && third === 'today' && fourth === 'color') return 'todayText.color';
      if (second === 'event' && third === 'today' && fourth === 'dot') return 'todayText.backgroundColor';
    }

    if (top === 'not-day-of-month') {
      if (second === 'color') return 'day.color';
      if (second === 'font-weight') return 'day.fontWeight';
    }

    if (pathStr === 'prev-month-btn-color') return 'prevMonthBtn.root.color';

    if (top === 'header-skeleton') {
      if (second === 'width') return 'headerSkeleton.root.width';
      if (second === 'margin-bottom') return 'headerSkeleton.root.marginBottom';
    }

    if (top === 'day') {
      if (second === 'background') return 'day.backgroundColor';
      if (second === 'font-family') return 'day.fontFamily';
      if (second === 'font-size') return 'day.fontSize';
    }

    if (top === 'daywrapper') {
      if (second === 'background') return 'dayWrapper.backgroundColor';
      if (second === 'border' && third === 'color') return 'dayWrapper.borderColor';
    }

    if (top === 'month-text') {
      if (second === 'color') return 'monthText.color';
      if (second === 'font-family') return 'monthText.fontFamily';
      if (second === 'font-weight') return 'monthText.fontWeight';
    }

    if (top === 'selected-day') {
      if (second === 'background') return 'selectedDay.backgroundColor';
      if (second === 'text' && third === 'background') return 'selectedDayText.backgroundColor';
      if (second === 'text' && third === 'color') return 'selectedDayText.color';
      if (second === 'text' && third === 'font-weight') return 'selectedDayText.fontWeight';
    }

    if (top === 'today') {
      if (second === 'background-color') return 'today.backgroundColor';
      if (second === 'border' && third === 'color') return 'today.borderColor';
      if (second === 'text' && third === 'background-color') return 'todayText.backgroundColor';
    }

    if (top === 'wrapper') {
      if (second === 'background') return 'calendar.backgroundColor';
      if (second === 'border' && third === 'color') return 'calendar.borderColor';
      if (second === 'border' && third === 'radius') return 'calendar.borderTopLeftRadius';
      if (second === 'border' && third === 'width') return 'calendar.borderTopWidth';
      if (second === 'shadow') return 'calendar.boxShadow';
    }

    if (top === 'year-text') {
      if (second === 'color') return 'yearText.color';
      if (second === 'font-family') return 'yearText.fontFamily';
      if (second === 'font-weight') return 'yearText.fontWeight';
    }
  }

  // ============================================================================
  // SLIDER-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'slider') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const pathStr = propertyPath.join('.');

    if (top === 'max-track' && second === 'background') return 'maximumTrack.backgroundColor';
    if (top === 'min-track' && second === 'background') return 'minimumTrack.backgroundColor';
    
    if (top === 'thumb') {
      if (second === 'background') return 'thumb.backgroundColor';
      if (second === 'height') return 'thumb.height';
      if (second === 'width') return 'thumb.width';
      if (second === 'border-radius') return 'thumb.borderTopLeftRadius';
    }
    
    if (top === 'tooltip') {
      if (second === 'background') return 'tooltip.backgroundColor';
      if (second === 'color') return 'tooltipLabel.color';
    }
    
    if (top === 'track') {
      if (second === 'height') return 'track.height';
      if (second === 'margin-vertical') return 'track.marginVertical';
      if (second === 'border-radius') return 'track.borderTopLeftRadius';
    }
  }

  // ============================================================================
  // ICON-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'icon') {
    const pathStr = propertyPath.join('.');
    
    if (pathStr === 'color') return 'text.color';
    if (pathStr === 'gap') return 'root.gap';
    if (pathStr === 'height') return 'icon.height';
    if (pathStr === 'min-width') return 'icon.minWidth';
    if (pathStr === 'width') return 'icon.width';
    if (pathStr === 'font-size') return 'icon.fontSize';
  }

  // ============================================================================
  // AUDIO-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'audio') {
    const pathStr = propertyPath.join('.');
    
    if (pathStr === 'width') return 'root.width';
  }

  // ============================================================================
  // MODAL-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'modal-dialog') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const pathStr = propertyPath.join('.');

    if (pathStr === 'background') return 'root.backgroundColor';
    if (pathStr === 'min-width') return 'root.minWidth';
    if (pathStr === 'radius') return 'root.borderTopLeftRadius';
    if (pathStr === 'margin') return 'root.marginTop';
    if (pathStr === 'z-index') return 'root.zIndex';

    if (top === 'btn') {
      if (second === 'cancel') {
        if (third === 'background') return 'cancelButton.root.backgroundColor';
        if (third === 'color') return 'cancelButton.text.color';
      }
      if (second === 'ok') {
        if (third === 'background') return 'okButton.root.backgroundColor';
        if (third === 'color') return 'okButton.text.color';
      }
    }

    if (top === 'description') {
      if (second === 'color') return 'message.text.color';
      if (second === 'font-family') return 'message.text.fontFamily';
      if (second === 'font-size') return 'message.text.fontSize';
      if (second === 'font-weight') return 'message.text.fontWeight';
    }

    if (top === 'title') {
      if (second === 'color') return 'icon.text.color';
      if (second === 'font-family') return 'icon.text.fontFamily';
      if (second === 'font-size') return 'icon.text.fontSize';
      if (second === 'font-weight') return 'icon.text.fontWeight';
      if (second === 'letter-spacing') return 'icon.text.letterSpacing';
      if (second === 'line-height') return 'icon.text.lineHeight';
    }

    if (top === 'body' && second === 'padding') return 'root.paddingTop';
    if (top === 'footer' && second === 'padding') return 'dialogActions.paddingTop';

    if (top === 'header') {
      if (second === 'background') return 'header.backgroundColor';
      if (second === 'border' && third === 'color') return 'header.borderColor';
      if (second === 'border' && third === 'width') return 'header.borderTopWidth';
      if (second === 'border' && third === 'style') return 'header.borderStyle';
      if (second === 'padding') return 'header.paddingTop';
      
      if (second === 'close-btn') {
        if (third === 'background') return 'closeBtn.root.backgroundColor';
        if (third === 'border-color') return 'closeBtn.root.borderColor';
        if (third === 'color') return 'closeBtn.icon.icon.color';
        if (third === 'border-width') return 'closeBtn.root.borderTopWidth';
        if (third === 'font-size') return 'closeBtn.icon.icon.fontSize';
        if (third === 'border-style') return 'closeBtn.root.borderStyle';
      }
    }

    if (top === 'icon') {
      if (second === 'color') return 'icon.icon.color';
      if (second === 'font-size') return 'icon.icon.fontSize';
    }
  }

  // ============================================================================
  // MESSAGE-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'message') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const pathStr = propertyPath.join('.');

    if (top === 'close-btn') {
      if (second === 'background' && third === 'color') return 'closeBtn.root.backgroundColor';
      if (second === 'border' && third === 'color') return 'closeBtn.root.borderColor';
      if (second === 'border' && third === 'radius') return 'closeBtn.root.borderTopLeftRadius';
      if (second === 'ripple' && third === 'color') return 'closeBtn.root.rippleColor';
      if (second === 'padding' && third === 'left') return 'closeBtn.root.paddingLeft';
      if (second === 'padding' && third === 'right') return 'closeBtn.root.paddingRight';
      if (second === 'icon' && third === 'size') return 'closeBtn.icon.icon.fontSize';
      if (second === 'padding' && !third) return 'closeBtn.root.paddingTop';
    }

    if (pathStr === 'color') return 'title.color';

    if (top === 'container') {
      if (second === 'background') return 'root.backgroundColor';
      if (second === 'border' && third === 'color') return 'root.borderColor';
      if (second === 'border' && third === 'width') return 'root.borderTopWidth';
      if (second === 'border' && third === 'radius') return 'root.borderTopLeftRadius';
      if (second === 'border' && third === 'style') return 'root.borderStyle';
      if (second === 'padding' && third === 'bottom') return 'root.paddingBottom';
      if (second === 'padding' && third === 'left') return 'root.paddingLeft';
      if (second === 'padding' && third === 'right') return 'root.paddingRight';
      if (second === 'padding' && third === 'top') return 'root.paddingTop';
    }

    if (top === 'text-wrapper' && second === 'padding' && third === 'left') {
      return 'message.paddingLeft';
    }
    if (top === 'text-wrapper' && second === 'padding' && !third) return 'message.paddingTop';

    if (top === 'title') {
      if (second === 'padding' && !third) return 'title.paddingTop';
      if (second === 'padding' && third === 'bottom') return 'title.paddingBottom';
      if (second === 'font' && third === 'size') return 'title.fontSize';
      if (second === 'font' && third === 'weight') return 'title.fontWeight';
    }

    if (top === 'icon' && second === 'size') return 'icon.icon.fontSize';
    if (top === 'text' && second === 'size') return 'text.fontSize';
  }

  // ============================================================================
  // LOTTIE-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'lottie') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    
    if (top === 'background' && second === 'color') return 'root.backgroundColor';

    if (top === 'content') {
      if (second === 'height') return 'content.height';
      if (second === 'width') return 'content.width';
    }
  }

  // ============================================================================
  // RATING-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'rating') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const pathStr = propertyPath.join('.');

    if (top === 'icon') {
      if (second === 'color') return 'icon.text.color';
      if (second === 'size') return 'icon.text.fontSize';
    }
    
    if (top === 'text') {
      if (second === 'color') return 'text.color';
      if (second === 'size') return 'text.fontSize';
      if (second === 'padding' && third === 'left') return 'text.paddingLeft';
    }
    
    if (pathStr === 'padding') return 'root.paddingTop';
    if (pathStr === 'opacity') return 'root.opacity';
  }

  // ============================================================================
  // FILEUPLOAD-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'fileupload') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];
    const fourth = propertyPath[3];
    const fifth = propertyPath[4];
    const pathStr = propertyPath.join('.');

    // Root background
    if (pathStr === 'background' || pathStr === 'background-color') {
      return 'root.backgroundColor';
    }

    // Border properties
    if (top === 'border') {
      if (second === 'color') return 'root.borderColor';
      if (second === 'style') return 'root.borderStyle';
      if (second === 'radius') return 'root.borderTopLeftRadius';
      if (second === 'width') return 'root.borderTopWidth';
    }

    // Icon properties
    if (top === 'icon') {
      if (second === 'color') return 'button.icon.icon.color';
      if (second === 'font' && third === 'size') return 'button.icon.icon.fontSize';
    }

    // Text properties
    if (top === 'text') {
      if (second === 'color') return 'button.text.color';
      if (second === 'font' && third === 'size') return 'button.text.fontSize';
      if (second === 'font' && third === 'weight') return 'button.text.fontWeight';
    }

    // Ripple
    if (pathStr === 'ripple-color' || pathStr === 'ripple.color') {
      return 'button.root.rippleColor';
    }
  }
  // ============================================================================
  // CURRENCY-SPECIFIC MAPPINGS
  // RN styles: root, label, labelWrapper, input, text
  // ============================================================================
  if (widget === 'currency') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];

    // label.color -> label.color
    if (top === 'label' && second === 'color') return 'label.color';
    // label.font.family -> label.fontFamily
    if (top === 'label' && second === 'font' && third === 'family') return 'label.fontFamily';
    // label.font.size -> label.fontSize
    if (top === 'label' && second === 'font' && third === 'size') return 'label.fontSize';
    // label.font.weight -> label.fontWeight
    if (top === 'label' && second === 'font' && third === 'weight') return 'label.fontWeight';

    // labelwrapper.background -> labelWrapper.backgroundColor
    if (top === 'labelwrapper' && second === 'background') return 'labelWrapper.backgroundColor';
    // labelwrapper.border.radius -> labelWrapper.borderRadius (stored as borderTopLeftRadius etc.)
    if (top === 'labelwrapper' && second === 'border' && third === 'radius') return 'labelWrapper.borderTopLeftRadius';
    // labelwrapper.min.height -> labelWrapper.minHeight
    if (top === 'labelwrapper' && second === 'min' && third === 'height') return 'labelWrapper.minHeight';
    // labelwrapper.padding -> labelWrapper.padding
    if (top === 'labelwrapper' && second === 'padding') return 'labelWrapper.paddingTop';
    // labelwrapper.width -> labelWrapper.width
    if (top === 'labelwrapper' && second === 'width') return 'labelWrapper.width';
  }
  // ============================================================================
  // SELECT-SPECIFIC MAPPINGS
  // RN styles: root, arrowButton.root, arrowButton.icon.icon, checkIcon.text,
  //            modalContent, selectItemText
  // ============================================================================
  if (widget === 'select') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];

    // arrow-button.background-color -> arrowButton.root.backgroundColor
    if (top === 'arrow-button' && (second === 'background-color' || second === 'background')) return 'arrowButton.root.backgroundColor';
    // arrow-button.border.color -> arrowButton.root.borderColor
    if (top === 'arrow-button' && second === 'border' && third === 'color') return 'arrowButton.root.borderColor';
    // arrow-button.border.width -> arrowButton.root.borderWidth
    if (top === 'arrow-button' && second === 'border' && third === 'width') return 'arrowButton.root.borderTopWidth';
    // arrow-button.border.style -> arrowButton.root.borderStyle
    if (top === 'arrow-button' && second === 'border' && third === 'style') return 'arrowButton.root.borderStyle';
    // arrow-button.border.radius -> arrowButton.root.borderRadius (stored per-corner)
    if (top === 'arrow-button' && second === 'border' && third === 'radius') return 'arrowButton.root.borderTopLeftRadius';
    if (top === 'arrow-button' && second === 'padding') return 'arrowButton.root.paddingTop';

    // arrow-button.icon.font-size -> arrowButton.icon.icon.fontSize
    if (top === 'arrow-button' && second === 'icon' && (third === 'font-size' || third === 'fontSize')) return 'arrowButton.icon.icon.fontSize';
    // arrow-button.icon.color -> arrowButton.icon.icon.color
    if (top === 'arrow-button' && second === 'icon' && third === 'color') return 'arrowButton.icon.icon.color';
    // arrow-button.icon.height -> arrowButton.icon.icon.height
    if (top === 'arrow-button' && second === 'icon' && third === 'height') return 'arrowButton.icon.icon.height';
    if (top === 'arrow-button' && second === 'icon' && third === 'padding') return 'arrowButton.icon.icon.paddingTop';
    // arrow-button.icon.border.color -> arrowButton.icon.icon.borderColor
    if (top === 'arrow-button' && second === 'icon' && third === 'border') {
      const fourth = propertyPath[3];
      if (fourth === 'color') return 'arrowButton.icon.icon.borderColor';
      if (fourth === 'width') return 'arrowButton.icon.icon.borderTopWidth';
      if (fourth === 'style') return 'arrowButton.icon.icon.borderStyle';
      if (fourth === 'radius') return 'arrowButton.icon.icon.borderTopLeftRadius';
    }

    // check.icon.color -> checkIcon.text.color
    if (top === 'check' && second === 'icon' && third === 'color') return 'checkIcon.text.color';
    // check.icon.font-size -> checkIcon.text.fontSize
    if (top === 'check' && second === 'icon' && (third === 'font-size' || third === 'fontSize')) return 'checkIcon.text.fontSize';

    // modal-content.background-color -> modalContent.backgroundColor
    if (top === 'modal-content' && (second === 'background-color' || second === 'background')) return 'modalContent.backgroundColor';
    // modal-content.border.color -> modalContent.borderColor
    if (top === 'modal-content' && second === 'border' && third === 'color') return 'modalContent.borderColor';
    // modal-content.border.width -> modalContent.borderWidth
    if (top === 'modal-content' && second === 'border' && third === 'width') return 'modalContent.borderTopWidth';
    // modal-content.border.style -> modalContent.borderStyle
    if (top === 'modal-content' && second === 'border' && third === 'style') return 'modalContent.borderStyle';
    // modal-content.border.radius -> modalContent.borderRadius
    if (top === 'modal-content' && second === 'border' && third === 'radius') return 'modalContent.borderTopLeftRadius';

    // modal-text.color -> selectItemText.color
    if (top === 'modal-text' && second === 'color') return 'selectItemText.color';
    // modal-text.font-family -> selectItemText.fontFamily
    if (top === 'modal-text' && (second === 'font-family' || second === 'fontFamily')) return 'selectItemText.fontFamily';
    if (top === 'modal-text' && second === 'font-size') return 'selectItemText.fontSize';
  }
  // ============================================================================
  // CAMERA-SPECIFIC MAPPINGS
  // RN styles: button.root, button.text, button.icon.icon
  // All themed props live under the nested button object, not root.
  // ============================================================================
  if (widget === 'camera') {
    const top = propertyPath[0];
    const second = propertyPath[1];

    if (pathStr === 'background' || pathStr === 'background-color') return 'button.root.backgroundColor';
    if (top === 'border' && second === 'color') return 'button.root.borderColor';
    if (top === 'border' && second === 'width') return 'button.root.borderTopWidth';
    if (top === 'border' && second === 'radius') return 'button.root.borderTopLeftRadius';
    if (pathStr === 'color') return 'button.icon.icon.color';
    if (pathStr === 'padding') return 'button.root.paddingTop';
    if (pathStr === 'min-height') return 'button.root.minHeight';
    if (pathStr === 'min-width') return 'button.root.minWidth';
    if (top === 'padding' && second === 'top') return 'button.root.paddingTop';
    if (top === 'padding' && second === 'bottom') return 'button.root.paddingBottom';
    if (top === 'padding' && second === 'left') return 'button.root.paddingLeft';
    if (top === 'padding' && second === 'right') return 'button.root.paddingRight';
  }
  // ============================================================================
  // DATETIME-SPECIFIC MAPPINGS
  // RN styles: root (app-input derivative), text, cancelBtn, selectBtn, dialog
  // Main themed props: root.backgroundColor/borderColor/borderWidth/borderRadius
  // and text.color/fontSize/fontWeight. Picker dialog sub-elements
  // (cancel-button, selected-button, header-text, selected) target dialog
  // internals not directly on _INSTANCE.styles -- best-effort mappings below.
  // ============================================================================
  if (widget === 'datetime') {
    const top = propertyPath[0];
    const second = propertyPath[1];
    const third = propertyPath[2];

    // root-level: background -> root.backgroundColor
    if (pathStr === 'background' || pathStr === 'background-color') return 'root.backgroundColor';

    // button.border.* -> root.border* (the RN input container holds border props)
    if (top === 'button' && second === 'border' && third === 'color') return 'root.borderColor';
    if (top === 'button' && second === 'border' && third === 'width') return 'root.borderTopWidth';
    if (top === 'button' && second === 'border' && third === 'style') return 'root.borderStyle';
    if (top === 'button' && second === 'border' && third === 'radius') return 'root.borderTopLeftRadius';
    if (top === 'button' && second === 'ripple' && third === 'color') return 'root.rippleColor';

    // cancel-button.* -> cancelBtn (picker dialog action button)
    if (top === 'cancel-button' && second === 'background') return 'cancelBtn.root.backgroundColor';
    if (top === 'cancel-button' && second === 'text' && third === 'color') return 'cancelBtn.text.color';
    if (top === 'cancel-button' && second === 'text' && third === 'size') return 'cancelBtn.text.fontSize';
    if (top === 'cancel-button' && second === 'text' && third === 'weight') return 'cancelBtn.text.fontWeight';

    // header-text.* -> dialog header text (not a direct RN key; map to dialog)
    if (top === 'header-text' && second === 'color') return 'dialog.color';
    if (top === 'header-text' && second === 'font' && third === 'size') return 'dialog.fontSize';
    if (top === 'header-text' && second === 'font' && third === 'weight') return 'dialog.fontWeight';

    // selected-button.* -> selectBtn (picker dialog select/ok button)
    if (top === 'selected-button' && second === 'background') return 'selectBtn.root.backgroundColor';
    if (top === 'selected-button' && second === 'text' && third === 'color') return 'selectBtn.text.color';
    if (top === 'selected-button' && second === 'text' && third === 'size') return 'selectBtn.text.fontSize';
    if (top === 'selected-button' && second === 'text' && third === 'weight') return 'selectBtn.text.fontWeight';

    // selected.text.* -> selected date text within the dialog
    if (top === 'selected' && second === 'text' && third === 'color') return 'text.color';
    if (top === 'selected' && second === 'text' && third === 'font-size') return 'text.fontSize';
    if (top === 'selected' && second === 'text' && third === 'font-weight') return 'text.fontWeight';

    // text.* -> text (main input display text)
    if (top === 'text' && second === 'color') return 'text.color';
    if (top === 'text' && second === 'font-size') return 'text.fontSize';
    if (top === 'text' && second === 'font-weight') return 'text.fontWeight';
  }
  // ============================================================================
  // VIDEO-SPECIFIC MAPPINGS
  // RN styles: root (simple media widget - height/width only)
  // ============================================================================
  if (widget === 'video') {
    if (pathStr === 'height') return 'root.height';
    if (pathStr === 'width') return 'root.width';
  }
  // ============================================================================
  // PANEL-FOOTER-SPECIFIC MAPPINGS
  // ============================================================================
  if (widget === 'panel-footer') {
    const pfSecond = propertyPath[1];
    if (top === 'padding') {
      if (pfSecond === 'block') return 'header.paddingBlock';
      if (pfSecond === 'inline') return 'header.paddingInline';
    }
  }

  // ============================================================================
  // GENERIC FALLBACK MAPPINGS (run after all widget-specific mappings)
  // ============================================================================
  // 1. Skeleton properties -> skeleton.*
  if (propertyPath[0] === 'skeleton') {
    return `skeleton.${TokenMappingService.mapToComputedProperty(last)}`;
  }


  // 2. Border properties -> root.border*
  if (propertyPath[0] === 'border') {
    const prop = propertyPath[1];
    const mapped = prop === 'radius' ? 'borderRadius' : `border${prop.charAt(0).toUpperCase() + prop.slice(1)}`;
    return `root.${mapped}`;
  }


  // 3. Padding properties -> root.padding*
  if (propertyPath[0] === 'padding') {
    const base = 'root.padding';
    if (propertyPath.length === 2) {
      const sub = TokenMappingService.mapToComputedProperty(propertyPath[1]);
      return `${base}${sub.charAt(0).toUpperCase() + sub.slice(1)}`;
    }
    return base;
  }


  // 4. Margin properties -> root.margin*
  if (propertyPath[0] === 'margin') {
    if (propertyPath.length === 2) {
      const sub = TokenMappingService.mapToComputedProperty(propertyPath[1]);
      return `root.margin${sub.charAt(0).toUpperCase() + sub.slice(1)}`;
    }
    return `root.margin`;
  }


  // 5. Dimensions -> root.*
  const computedLast = TokenMappingService.mapToComputedProperty(last);
  if (widget !== 'navbar' && ['height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'].includes(computedLast)) {
    let prop = computedLast;
    if (prop === 'height') prop = 'minHeight'; // Buttons use minHeight
    return `root.${prop}`;
  }


  // 6. Gap -> content.gap
  if (last === 'gap') return 'content.gap';


  // 7. Text properties -> text.*
  const textProps = ['color', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'lineHeight', 'letterSpacing', 'textTransform'];
  if (textProps.includes(computedLast)) {
    if (pathStr === 'background-color' || pathStr === 'background') return 'root.backgroundColor';
    return `text.${computedLast}`;
  }


  // 8. Ripple & Position -> root.*
  if (pathStr === 'ripple.color') return 'root.rippleColor';
  if (propertyPath[0] === 'position') return `root.${computedLast}`;


  // 9. General Fallback
  let prop = computedLast;
  if (prop === 'background') prop = 'backgroundColor';
  if (prop === 'radius') prop = 'borderRadius';
  if (prop === 'shadow' || prop === 'elevation') {
    prop = platform === 'android' ? 'elevation' : 'boxShadow';
  }


  return `root.${prop}`;
 }


    /**
     * Constructs the full extraction command.
     */
    static getExtractionCommand(widget: Widget, propertyPath: string[], studioWidgetName: string = '{widget}', platform: 'android' | 'ios' = 'android'): string {
        const stylesKey = (widget === 'cards' || widget === 'formcontrols') ? 'calcStyles' : 'styles';
        const mappedPath = this.mapToRnStylePath(propertyPath, widget, platform);

        if (widget === 'cards') {
            return `App.appConfig.currentPage.Widgets.supportedLocaleList1.itemWidgets[0].card1._INSTANCE.${stylesKey}.${mappedPath}`;
        }
        if (widget === 'formcontrols') {
            return `App.appConfig.currentPage.Widgets.supportedLocaleForm1.formWidgets.entestkey.calcStyles.${mappedPath}`;
        }

        return `App.appConfig.currentPage.Widgets.${studioWidgetName}._INSTANCE.${stylesKey}.${mappedPath}`;
    }
}
