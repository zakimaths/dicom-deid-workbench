---
name: DICOM Workbench
description: A dark terminal-style workbench for learning about medical images.
colors:
  background: "#0a0a0a"
  panel: "#111611"
  raised: "#192019"
  screen: "#080a08"
  text: "#e8ebdd"
  secondary: "#a6b3a1"
  accent: "#33ff00"
  accent-hover: "#87ff68"
  warning: "#ffb000"
  warning-surface: "#201b10"
  error: "#ff5c5c"
  error-surface: "#251414"
  info: "#7ea2ff"
  category: "#b68cff"
  divider: "#294329"
  boundary: "#63785d"
  shadow: "#030503"
typography:
  display:
    fontFamily: '"Press Start 2P", "JetBrains Mono", "SFMono-Regular", Consolas, monospace'
    fontSize: "clamp(16px, 1.6vw, 24px)"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "-0.5px"
  body:
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace'
    fontSize: "12px"
    letterSpacing: "1px"
rounded:
  square: "0px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-6: "24px"
  space-8: "32px"
  space-12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.square}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.square}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  input-number:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    padding: "8px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
---

# Design System: DICOM Workbench

## Overview

**Creative North Star: "Arcade Terminal"**

This name comes from the incumbent stylesheet. The interface uses near-black green surfaces, bright green actions, square geometry and monospaced text. It is a working instrument: the image, controls, explanations and inspection results carry the page.

The teaching library and PNG exercise inherit this system. Their content remains photographic medical imagery; the terminal treatment belongs to the surrounding interface.

**Key Characteristics:**

- Dark, bordered panels with a bright green action accent.
- Monospaced reading text and limited pixel-font display text.
- Real image proportions, clear labels and explicit operation states.
- Controls with plain-language hover and focus explanations.

## Colors

The palette combines green-tinted neutrals with a vivid primary accent and separate status colours.

### Primary

The accent marks primary buttons, current values, focus outlines and selected items. Its lighter hover variant supplies immediate feedback.

### Status colours

Amber identifies caution, red identifies failures, blue marks sample and action information, and violet distinguishes replaced values. Status meaning is also written out; colour does not carry the message alone.

### Neutral

The background surrounds panel surfaces. Raised surfaces separate headings and verification areas; the screen provides the image backdrop. Main text and secondary text form a restrained reading hierarchy. Dividers group related content, while boundary strokes outline actionable or structural edges.

**The Image Rule.** Keep decorative colour treatments out of image content. Preserve its source colours and proportions; draw temporary selection outlines only as an editing aid.

## Typography

Locally hosted JetBrains Mono provides body text, controls, technical values and teaching headings. Locally hosted Press Start 2P appears in the main headline and the initial empty-state message. The main display scale is recorded in the frontmatter; mobile rules keep it compact.

Body text uses a regular weight, with semibold emphasis and tabular numeric values. Small section labels and supporting text sit below the main reading size. Teaching headings use the body family at larger sizes, keeping long anatomy labels legible. Introductory prose is constrained to a readable measure of about 60 characters.

## Layout

The main container is centred and bounded at 1504px, with 32px desktop padding. The DICOM workbench places the image and controls beside an inspection column, stacking them below 850px. The teaching PNG exercise occupies that same workbench region with its own image-and-report layout; it stacks below 800px. Exercise actions precede the image, and the report follows it in mobile reading order.

The teaching library is a native dialog with a 300px catalogue beside a flexible image view. Below 760px, the image view leads and the catalogue follows. Actions wrap, and compact-screen controls occupy available width. Spacing follows the extracted four-pixel-based steps, with a few local gaps for dense controls.

## Elevation & Depth

Depth is mainly conveyed by surface changes and one-pixel borders. A small hard offset shadow grounds the workbench; the synthetic-example button uses a related offset. Tooltips use a hard shadow and a bright boundary. The teaching dialog dims the background with a black translucent backdrop. There is no general floating-card shadow system.

## Shapes

Buttons have square corners. Panels, input boundaries, slider thumbs and status markers use straight edges. Main controls provide 44px or larger touch targets; primary buttons have a 48px minimum height. Visible keyboard focus uses a bright two-pixel outline with an offset from the target.

## Components

### Buttons

Primary buttons use dark text on the bright accent. Secondary buttons use panel surfaces, readable text and a boundary stroke. Hover changes the surface or border; active controls shift by one pixel. Disabled controls use raised surfaces and muted boundaries. These states share short 120ms transitions, disabled under reduced-motion preferences.

### Inputs

Numeric fields use bordered dark surfaces with visible labels and full-width editable areas. Image adjustment sliders have rectangular green thumbs. Teaching-library search and modality selection follow the same surface and boundary language. Number fields reflow from four columns to two on narrow screens.

### Navigation and source links

Profile icons use consistent 44px targets in the header and footer. Hover and focus introduce the accent against a dark background. Sources and licences remain explicit links alongside the relevant teaching image or exercise.

### Panels, badges and results

Headings and verification areas use raised surfaces. The inspection list separates rows with dividers and writes each action in a bordered badge. Sample badges use the information colour. Teaching cards combine an image thumbnail with a short title and secondary details; their selected state uses an accent boundary and `aria-pressed`.

### Teaching image exercise

The image sits on black within the workbench. A row of numbered actions introduces the fake-details exercise. Beside it, a labelled metadata list and a written verification result explain what remains. Before/current comparison is explicit in both button state and the image caption. Custom rectangle controls are available in a disclosure, keeping the primary sequence visible.

### Help and feedback

Button explanations appear on hover and keyboard focus. The exercise also has a persistent help area and live status text. A hidden control or disabled export communicates workflow state; surrounding text explains the conditions rather than relying on its appearance alone.

## Do's and Don'ts

### Do:

- **Do** reuse the existing semantic colours and local fonts.
- **Do** keep image proportions and source colours intact.
- **Do** describe status and limits in text beside the operation.
- **Do** preserve keyboard focus, readable labels and wrapping controls.

### Don't:

- **Don't** apply terminal tint, pixelation or decorative scanlines to the medical image.
- **Don't** use the display pixel font for long explanations or metadata lists.
- **Don't** communicate completion or failure through colour alone.
