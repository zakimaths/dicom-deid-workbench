# Mobile and accessibility review — 5 September 2026

This pass covers the public teaching demo, the local DICOM workbench and the local hospital-records workspace. The established dark terminal styling and original scan colours are retained.

## Changes from the review

| Finding | Resolution |
| --- | --- |
| Enlarged text could push narrow headers and grid content beyond the screen. | Header items wrap; narrow grid tracks can shrink; long titles can wrap. |
| A fixed off-screen offset did not reliably hide the enlarged skip link, and its focused state could cover navigation. | The hidden position follows its own height; the focused link takes space above the header and keeps its width within the viewport. |
| WebKit native practice-mode options could overflow at doubled text sizes. | Long selected labels stay within the control and truncate with an ellipsis. Full choices remain in the native menu. |
| The records test sometimes checked worker cleanup before its browser notification arrived. | The test awaits the actual worker-close event. Production termination behaviour is unchanged. |

## Repeated checks

- 33 standard axe states across Chromium, Firefox and WebKit at desktop and phone widths: keyboard rectangle editing, focus, dialog dismissal, zoom, undo, OCR review and cancellation.
- 64 additional mobile states across Chromium and WebKit at 320 × 740, 390 × 844, 844 × 390 and 768 × 1024: touch taps, scan selection, numbered boxes, zoom, scrubbed PNG downloads, 200% computed text sizing and keyboard skip navigation.
- 27 local-record axe states and nine complete text/image workflows across all three engines at 1440, 390 and 320 pixels wide.
- All 50 public teaching scans and library controls in all three engines; local imports, malformed-input recovery, expired exports and selection changes.
- Independent pydicom/NumPy checks of 21 browser exports; 16 pixel, PNG and challenge unit checks.

No WCAG A/AA rule violations, horizontal page overflow or browser exceptions remain in the passing tested mobile states. Axe uses WCAG 2, 2.1 and 2.2 A/AA tags. Source-image proportions remain intact and zoomed content scrolls inside its picture area. Phone views stack the workbench and report vertically; no extra navigation system was introduced.

The static design detector flagged one intentionally hidden image with no source before a teaching scan is loaded. The loader supplies and verifies its source before showing it. This is not a visible broken image; all 50 real library images were checked.

## Limits

This is not a WCAG certification or clinical validation. The mobile checks use browser emulation, not physical phones. VoiceOver/TalkBack listening, installed Safari, actual browser/OS zoom, custom text spacing and usability sessions with disabled learners remain untested. Doubling computed font sizes is a targeted reflow stress test, not a substitute for every device's text-size setting. Performance was not benchmarked in this accessibility pass.

## Repeat

```sh
npm test
npm run build:preview
npm run test:accessibility
npm run test:mobile
npm run test:records
npm run test:preview
npm run test:browser
```

The mobile command fails on detected WCAG violations, page overflow, browser errors or broken download/navigation interactions. It runs in CI and before public-demo deployment. Generated reports and screenshots are stored in `output/accessibility`, `output/mobile-audit` and `output/records-browser`.
