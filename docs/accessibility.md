# Accessibility checks for 0.3.0

The automated pass uses axe-core 4.13.0 with WCAG 2 A/AA, 2.1 A/AA and 2.2 AA rule tags. It covers the home page, library, challenge, scored/zoomed exercise, zoomed-out exercise and OCR review. Chromium, Firefox and WebKit run at desktop (1440px) and phone (390px) widths with reduced motion: 33 scans in total. These are tested states, not a WCAG certification.

The initial scan flagged disabled-button help labels on generic spans. They now use a named group while disabled so the extra keyboard stop has meaningful semantics. The decorative circle/check icon is hidden from assistive technology and has adjacent written status; axe's inconclusive contrast result on this non-text glyph does not carry the status information.

Manual code/visual review and scripted interaction cover:

- Visible focus, native dialog Escape/return focus, and leaving the picture with Tab.
- Arrow-key movement, Shift + arrow resizing, Enter to add a rectangle and equivalent numeric controls.
- Plain-language labels, announced progress/results, zoom, undo and per-box editing/removal.
- Persistent expandable button help for touch users; hover is optional.
- No horizontal page overflow at the tested widths; original image proportions are retained.
- All control targets in the new exercise are at least 44px high, apart from the native checkbox whose surrounding label provides the larger target.

The mechanical design detector also flagged the library image's initially empty source (it is intentionally hidden until loaded) and two existing type sizes. These are reviewed false positives/incumbent design choices, not new broken images. No broad visual redesign was made.

To repeat:

```sh
npm run build:preview
npm run test:accessibility
```

Results and screenshots are saved under `output/accessibility/`. Remaining work: actual VoiceOver/screen-reader listening, installed Safari and physical touch-device testing, 200–400% text/zoom review, and sessions with disabled learners. Browser-engine tests do not substitute for those. Use the scoped review template in GitHub to record actual findings; do not mark them completed in advance.

## Local hospital-record workspace (0.4.0)

The new `/records` route was tested in Chromium, Firefox and WebKit at 1440 px and 390 px, with reduced motion. Eighteen automated axe states (empty, reviewed text and reviewed image) produced no WCAG A/AA violations. Full flows cover file import, manual text selection retained after re-suggesting, actual downloaded TXT/PNG contents, full-size image inspection, OCR worker termination, acknowledgement invalidation and malformed-import recovery. Numbered outlines distinguish proposed image selections from applied erasure. No new screen-reader/VoiceOver or physical-touch testing is claimed.
