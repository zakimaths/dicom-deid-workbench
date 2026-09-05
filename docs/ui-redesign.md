# Interface design notes

## Original local interface

This note records the original arcade-style update on 5 September 2026. Later sample, editing and browser-demo changes are described in the [changelog](../CHANGELOG.md).

The local interface has one route (`/`) and uses plain HTML/CSS/JavaScript; no component library or frontend build. Python serves explicit local assets and the existing API. No theme selector, client-side router, search, dialogs, authentication UI or browser persistence. The local session token, upload limits and expiry are owned by the existing service.

The UI uses element IDs for its event handlers, CSS variables for shared styling, a canvas for the image and a generated list for metadata actions. The redesign preserves these connections and all processing code.

## Controls and states

| Area | Controls and behaviour | Important states |
| --- | --- | --- |
| Shell | Home `/`; external GitHub destination; keyboard navigation | Narrow width, zoom, focus |
| Import | Synthetic example; native file picker; drag/drop; 8 MiB limit | Ready, busy, invalid/unsupported file, retry |
| Viewer | Actual output pixel preview; level/window sliders; reset; spacing | Empty, loaded, signed values, unchanged pixel math |
| Report | Real counts and action rows; contained scroll; privacy notice | Empty, loaded, long field names |
| Export | Acknowledgement gates DICOM download; separate JSON report | Disabled, enabled, download, expired result |
| Clear | Clears preview, acknowledgement and result; supports new import | Loaded → empty; failed clear remains visible |
| Service | Local token, Host/Origin checks, no-store, explicit assets | Existing security tests; fonts remain local |

## Design choices

Use the requested near-black, green-tinted palette with semantic amber warnings, red errors, blue information and purple replacement categories. Pixel typography is restricted to short headings; readable monospace covers controls, reports and prose. Large counts use tabular numerals. Square framing, one hard shadow on the workspace, and a restrained status prompt supply the arcade character without altering the image.

The working surface replaces the previous marketing-style headline. Panes stack on smaller screens. Font files are local and licensed; no third-party request is introduced at runtime.

## Checks run for that update

Verified on macOS in Chromium on 5 September 2026:

- 32 Python tests and 7 JavaScript pixel tests pass; Ruff checks and formatting pass. Source and wheel builds succeed, including all font assets and licences.
- Browser comparison against the original UI gives identical preview data, metadata reports and canvas pixel hashes. Reopening the browser download confirms identical DICOM pixel bytes and empty identity placeholders.
- Synthetic example, native file picker, drag/drop, sliders, reset, acknowledgement, both downloads, clear, invalid input, retry and expiry work. Loading uses real request state.
- Skip link, visible keyboard focus, arrow-key sliders and checkbox keyboard control work. Reduced motion removes transitions.
- Desktop (1440px), tablet (768px), mobile (390px), narrow mobile (320px), and 200% CSS zoom have no page-wide horizontal overflow. A long metadata label wraps at 320px. Screenshots were visually inspected.
- No external asset requests or browser JavaScript errors occurred. Local font routes retain CSP and no-store headers, covered by three focused tests.
- Main text contrast is 13.76:1 and secondary text 7.59:1 against raised panels; control boundaries are 3.47:1. Semantic accent text exceeds 6:1 against the base panel.

[Synthetic example screenshot](screenshot.png). Run `make test` for the repeatable processing and server suite. Use the checklist above to repeat the browser workflows with the built-in synthetic example. Compare reports and pixel bytes rather than whole exported DICOM files, because new instance identifiers are intentional.

Safari, Firefox, a screen reader, and physical touch devices were not tested. The 200% check uses CSS zoom rather than a browser-menu zoom setting. No DICOM processing, windowing calculations, API contracts or security policy changed; server changes only expose the three local font files.

