<!-- AUTO-GENERATED FILE. Do not edit manually. -->

# Token Reference Table

This table lists all tokens for this component:

| Token | Description |
|-------|------------|
| heading.background | Background of the top bar where steps and progress live. A different tone from the body helps users see navigation vs. form content.<br>CSS variable: --wm-wizard-heading-background |
| heading.border.width | Thickness of the border around the header. Use it to draw a clear line between the step rail and the content below.<br>CSS variable: --wm-wizard-heading-border-width |
| heading.border.style | Border style for the header region: none, solid, dashed, or dotted.<br>CSS variable: --wm-wizard-heading-border-style |
| heading.border.color | Color of the header outline. Transparent keeps the header open; a contrast color separates it from the wizard body.<br>CSS variable: --wm-wizard-heading-border-color |
| heading.border.radius | Corner rounding for the header. Align with the main wizard radius so the top and body feel like one component.<br>CSS variable: --wm-wizard-heading-border-radius |
| heading.padding | Padding inside the header around steps and labels. Increase on small screens so tap targets and text stay comfortable.<br>CSS variable: --wm-wizard-heading-padding |
| heading.box-shadow | Shadow on the header only—adds depth under the progress area without lifting the whole wizard.<br>CSS variable: --wm-wizard-heading-box-shadow |
| heading.width | Base header width; only meaningful in vertical orientation, which overrides this per appearance. Horizontal appearances never reference this var.<br>CSS variable: --wm-wizardstepper-heading-width |
| heading.height | Base header height; only meaningful in vertical orientation, which overrides this per appearance. Horizontal appearances never reference this var.<br>CSS variable: --wm-wizardstepper-heading-height |
| heading.display | How the header lays out: block stacks rows; flex lines up step navigation for horizontal scanning.<br>CSS variable: --wm-wizard-heading-display |
| heading.justify-content | How steps spread in the header: space-between balances few or many steps; flex-start, center, or flex-end pin the rail left, middle, or right for your layout.<br>CSS variable: --wm-wizard-heading-justify-content |
| step.container.gap | Space between the step marker, title, and helper text within each step. Clear spacing makes each step quicker to scan.<br>CSS variable: --wm-wizard-step-gap |
| step.container.background | Background of the step navigation track—the band behind connectors and markers. Tints that rail separately from the rest of the header when you want a stronger progress strip.<br>CSS variable: --wm-wizard-step-connector-background |
| step.container.border.color | Border color around each step row in the navigation. Subtle lines separate steps; transparent keeps the rail minimal.<br>CSS variable: --wm-wizard-step-border-color |
| step.container.border.width | How strong the outline is around each step row. Thicker borders emphasize individual steps.<br>CSS variable: --wm-wizard-step-border-width |
| step.container.border.style | Line style for step rows: solid, dashed, dotted, or none, plus other standard CSS border styles.<br>CSS variable: --wm-wizard-step-border-style |
| step.container.border.radius | Corner rounding for each step row. Pills or chips make tabs and stacked steps feel tappable and friendly.<br>CSS variable: --wm-wizard-step-border-radius |
| step.container.padding | Padding inside each step row so labels and markers aren't flush against the edges.<br>CSS variable: --wm-wizard-step-padding |
| step.container.box-shadow | Shadow on individual step rows. Use sparingly to lift the active or hovered step without cluttering the rail.<br>CSS variable: --wm-wizard-step-box-shadow |
| step.container.justify-content | How the steps are aligned along the step strip: center, flex-start, flex-end, space-between. Prefix with safe (e.g. safe center) to keep the first step visible when the strip overflows.<br>CSS variable: --wm-wizardstepper-step-container-justify-content |
| step.connector.height | Length of the connector lines along the step strip: the line's height in a vertical stepper, its width in a horizontal one. Use px, em, rem, or %.<br>CSS variable: --wm-wizardstepper-step-connector-height |
| step.connector.width | Thickness of the connector lines, in both orientations. Tied to theme border width so the progress path matches other outlines. states.active / states.finished may override it; the value styles the line after that step.<br>CSS variable: --wm-wizardstepper-step-connector-width |
| step.connector.style | Line style between markers: solid for a steady path, dashed or dotted for a lighter guide, none to hide connectors. states.active / states.finished may override it; the value styles the line after that step.<br>CSS variable: --wm-wizardstepper-step-connector-style |
| step.connector.color | Color of the lines between steps. Should stay visible but quieter than active markers so progress is easy to follow. states.active / states.finished may override it; the value styles the line after that step.<br>CSS variable: --wm-wizardstepper-step-connector-color |
| step.connector.placement | Offset of the connector line: its top offset in a horizontal stepper, its left offset in a vertical one.<br>CSS variable: --wm-wizardstepper-step-connector-placement |
| step.connector.gap | Space between a step and its connector line (step.gap spaces the marker and the title inside a step).<br>CSS variable: --wm-wizardstepper-step-connector-gap |
| step.connector.display | Whether connector lines are drawn: block shows them, none hides them and frees their space.<br>CSS variable: --wm-wizardstepper-step-connector-display |
| step.indicator.size | Size of each step marker (number, dot, or icon). Larger targets are easier to see and align with touch-friendly layouts. Use px, em, or rem.<br>CSS variable: --wm-wizard-step-indicator-size |
| step.indicator.background | Fill behind each step marker. A solid fill helps the current and completed steps stand out; transparent keeps the rail minimal.<br>CSS variable: --wm-wizard-step-indicator-background |
| step.indicator.border.width | Ring thickness around each marker. Stronger rings make inactive steps easier to spot at a glance.<br>CSS variable: --wm-wizard-step-indicator-border-width |
| step.indicator.border.style | Border style around markers: solid, dashed, dotted, or none.<br>CSS variable: --wm-wizard-step-indicator-border-style |
| step.indicator.border.color | Outline color for step markers. Use contrast for clarity and to meet focus-state expectations.<br>CSS variable: --wm-wizard-step-indicator-border-color |
| step.indicator.border.radius | Shape of markers—fully rounded reads as chips or pills; smaller radius reads as squares with soft corners.<br>CSS variable: --wm-wizard-step-indicator-border-radius |
| step.indicator.box-shadow | Shadow on markers. Light elevation can highlight the current step without overpowering labels.<br>CSS variable: --wm-wizard-step-indicator-box-shadow |
| step.indicator.padding | Space inside the marker around numbers or icons so glyphs don't touch the ring.<br>CSS variable: --wm-wizard-step-indicator-padding |
| step.title.color | Color of each step's primary label in the navigation. Strong contrast helps users see where they are in the flow.<br>CSS variable: --wm-wizard-step-title-color |
| step.title.height | Base title-label height; only meaningful for the classic appearance, which overrides this. Other appearances never reference this var.<br>CSS variable: --wm-wizardstepper-step-title-height |
| step.title.background | Base title-label background; only meaningful for the classic appearance, which overrides this. Other appearances never reference this var.<br>CSS variable: --wm-wizardstepper-step-title-background |
| step.title.font.family | Font for step labels next to markers. Use your theme's heading or label family so the wizard matches the rest of the app.<br>CSS variable: --wm-wizard-step-title-font-family |
| step.title.font.weight | Weight of step labels. Bolder text emphasizes the current step; lighter weight keeps long titles calmer.<br>CSS variable: --wm-wizard-step-title-font-weight |
| step.title.font.size | Size of step labels. Larger type improves scan distance; smaller type fits more steps on one row.<br>CSS variable: --wm-wizard-step-title-font-size |
| step.title.line-height | Line height when step labels wrap. Generous leading keeps multi-line titles readable in the rail.<br>CSS variable: --wm-wizard-step-title-line-height |
| step.title.letter-spacing | Letter spacing for step labels. Slight tracking can improve all-caps or short titles in narrow layouts.<br>CSS variable: --wm-wizard-step-title-letter-spacing |
| step.title.padding | Padding around each step label. Adds space between text and markers or connectors for clearer tap and read targets.<br>CSS variable: --wm-wizard-step-title-padding |
| step.description.color | Color of supporting text under each step name. Keep it slightly softer than the title so hierarchy stays clear.<br>CSS variable: --wm-wizard-step-description-color |
| step.description.font.family | Font for step helper text. Usually matches body or caption styles for a supportive, secondary feel.<br>CSS variable: --wm-wizard-step-description-font-family |
| step.description.font.weight | Weight of helper text under each step. Medium weights can improve skim reading without competing with titles.<br>CSS variable: --wm-wizard-step-description-font-weight |
| step.description.font.size | Size of helper text. Smaller than titles so users notice the step name first, then optional context.<br>CSS variable: --wm-wizard-step-description-font-size |
| step.description.line-height | Line height for helper text. Extra leading helps two-line hints stay readable under tight step columns.<br>CSS variable: --wm-wizard-step-description-line-height |
| step.description.letter-spacing | Letter spacing for helper text. Subtle tracking improves dense captions in the step rail.<br>CSS variable: --wm-wizard-step-description-letter-spacing |
| step.icon.size | Size of icons inside markers (checkmarks, arrows, etc.). Should feel balanced with step numbers and label text.<br>CSS variable: --wm-wizard-step-icon-font-size |
| step.icon.color | Color of icons inside markers (checkmarks, arrows, etc.). Should feel balanced with step numbers and label text.<br>CSS variable: --wm-wizard-step-icon-color |
| step.count.color | Color of numbers inside step markers (for example 1, 2, 3). Should stay readable on both default and filled marker backgrounds.<br>CSS variable: --wm-wizard-step-count-color |
| step.count.font.family | Typeface for numbers inside markers. Match the theme's numeric or label style for a consistent look.<br>CSS variable: --wm-wizard-step-count-font-family |
| step.count.font.weight | Weight of step numbers. Slightly bolder weights improve legibility at small sizes.<br>CSS variable: --wm-wizard-step-count-font-weight |
| step.count.font.size | Size of numbers inside markers. Scale with indicator size so digits stay centered and easy to read.<br>CSS variable: --wm-wizard-step-count-font-size |
| step.count.line-height | Line height for step numbers if they wrap. Keeps multi-digit or localized labels from clipping.<br>CSS variable: --wm-wizard-step-count-line-height |
| step.count.letter-spacing | Letter spacing for numbers in markers. Small tweaks help single digits look optically centered.<br>CSS variable: --wm-wizard-step-count-letter-spacing |
| step.size | Base dot/marker size; only meaningful for the dottedstepper/dottedstepper-textinline appearances, which override this. Other appearances never reference this var.<br>CSS variable: --wm-wizardstepper-step-size |
| step.display | Layout mode for step items: inline-flex for a horizontal rail, flex for richer alignment, block for a vertical stack—match how users should scan the flow.<br>CSS variable: --wm-wizard-step-display |
| step.min-width | Minimum width of each step. Lower it, or use fit-content, to let steps hug their labels.<br>CSS variable: --wm-wizardstepper-step-min-width |
| step.gap | Space between the step marker, title, and helper text within each step. Clear spacing makes each step quicker to scan.<br>CSS variable: --wm-wizard-step-gap |
| step.padding | Padding inside each step row so labels and markers aren't flush against the edges.<br>CSS variable: --wm-wizard-step-padding |
| step.background | Background of each step row in the navigation. Use fills or tints to show hover, focus, or grouping without changing the global track color.<br>CSS variable: --wm-wizard-step-background |
| step.border.color | Border color around each step row in the navigation. Subtle lines separate steps; transparent keeps the rail minimal.<br>CSS variable: --wm-wizard-step-border-color |
| step.border.width | How strong the outline is around each step row. Thicker borders emphasize individual steps.<br>CSS variable: --wm-wizard-step-border-width |
| step.border.style | Line style for step rows: solid, dashed, dotted, or none, plus other standard CSS border styles.<br>CSS variable: --wm-wizard-step-border-style |
| step.border.radius | Corner rounding for each step row. Pills or chips make tabs and stacked steps feel tappable and friendly.<br>CSS variable: --wm-wizard-step-border-radius |
| step.box-shadow | Shadow on individual step rows. Use sparingly to lift the active or hovered step without cluttering the rail.<br>CSS variable: --wm-wizard-step-box-shadow |