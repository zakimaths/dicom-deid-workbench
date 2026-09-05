# What has been tested

This page records checks that were actually run. Passing them supports the behaviours listed here; it does not certify anonymity, clinical suitability or compatibility with every DICOM viewer.

## Local tool, version 0.2.1

The [0.2.1 audit](audit-0.2.1.md) passed 117 Python tests and 7 JavaScript pixel-math tests. It also ran 42 workflow groups across Chromium, Firefox and WebKit, reopened 21 downloaded DICOM files, and compared all pixels in 18 public-sample previews with pydicom's windowing calculation.

The Python checks cover metadata removal, private and nested fields, identifiers, saved-file verification, malformed inputs, rectangular edits, command-line behaviour and the local service. Generated cases include 100 seeded random rectangle sets, 100 truncated files, 200 random headers, and the maximum supported image and rectangle count. Those cases run inside test functions; they are not extra pytest test items.

Browser checks cover all samples, file selection and drag-and-drop, contrast/reset, numeric and drawn rectangles, pending edits, acknowledgement, downloads, stale responses, failures, clearing and expiry. Layout checks use 320, 390, 768 and 1440px widths. No page exceptions or external asset requests occurred in those workflows.

[All six CI jobs passed](https://github.com/zakimaths/dicom-deid-workbench/actions/runs/33950102081). Python checks ran on macOS ARM, macOS Intel and Linux; browser workflows ran on macOS ARM and Linux. The five synthetic/semantic digests and all six public-fixture source/pixel digests matched across the three Python platforms. A fresh wheel installation also loaded the UI assets and processed all six public samples.

## Static browser demo

The public [preview](preview.md) has a separate test suite because it does not use the local API. `npm run test:preview` checks the built site under a project subpath in Chromium, Firefox and WebKit. It covers eight sample assets, contrast/reset, sample edits, PNG/report exports, clearing, rejected file drops and responsive layout. It also rejects backend calls, non-GET requests and requests outside the site, and checks that the page does not write cookies or browser storage.

The current local suite has 118 Python tests, including the static build boundary/repeatability check, and passes with pytest 9.0.3 after the test-runner security update. The 7 numerical JavaScript tests also pass.

The Pages workflow runs these checks before publishing the allowlisted frontend folder. Check the workflow result for the commit you are using; a previous local-tool test result does not cover a later preview change.

## Earlier milestones

| Milestone | Recorded checks |
| --- | --- |
| First version | 29 Python tests, 7 pixel tests, Chromium checks, clean source installation and packaged assets |
| Arcade-style interface | 32 Python tests, 7 pixel tests, unchanged rendering/output checks, responsive and keyboard review |
| First two public samples | 37 Python tests, 7 pixel tests, pinned source hashes and browser checks |
| Stored-pixel erasing, 0.2.0 | 70 Python tests, 7 pixel tests, NumPy comparisons, downloaded-file checks and a fresh edit-expiry timer |

The [0.2.0 CI run](https://github.com/zakimaths/dicom-deid-workbench/actions/runs/33948284304) passed on both Mac architectures and Linux. Its five fixture/semantic digests matched across platforms. The original ten-page research PDF was checked for all 96 action IDs and visually reviewed when it was published; it remains a dated research record.

## Repeat the checks or report a problem

Follow the commands in the [README](../README.md#run-the-checks). State the commit, operating system, architecture, Python/browser version, steps and expected result when reporting a bug. Use a generated fixture with made-up identifiers. Never attach patient data.

The work does not include an external IOD validator, a real-patient privacy study, validated OCR, defacing evaluation, diagnostic-display calibration, a screen reader or physical touch-device testing. Playwright WebKit is useful browser coverage, but it is not a test of the installed Safari application. The earlier 200% layout check used CSS zoom, not the browser's zoom menu.


## Teaching library — 5 September 2026

Added 50 distinct published images: 15 MRI, 15 CT and 20 X-rays. Each source and shipped picture has at least 512 pixels on both sides. Images were visually reviewed for useful anatomy, starting contrast and obvious identifying text. This is not expert clinical validation; related views, false-colour composites and source-labelled conditions are identified in the notes. See the [collection details](teaching-library.md) and [individual credits](teaching-image-credits.md).

- 120 Python checks passed, including the catalogue, serving boundaries and repeatable static build.
- Seven numerical pixel-display checks passed.
- Local browser workflows passed in Chromium, Firefox and WebKit; all 50 teaching images were opened in each engine, alongside the existing DICOM exercises. Twenty-one downloaded DICOM results passed independent pydicom/NumPy verification.
- The static demo passed all three engines, opening all 50 teaching images and all eight exercise samples. Library checks cover labels, decoded dimensions, filters, search, navigation, contrast/reset, fitted image bounds, phone selection/focus, public share links, cold deep links, corrupt images, delayed catalogue closing and rapid image changes. Network requests remain same-site; browser-memory blob URLs are checked for the same origin.
- All 100 full-image/thumbnail files were regenerated from the pinned source bytes with matching SHA-256 hashes using Pillow 12.3.0 and libjpeg-turbo 3.1.4.1. The full JPEGs decoded successfully and contained no EXIF, comment or ICC payloads. This does not assess identifying content in their pixels.
- The static output contains 122 allowlisted frontend assets. Python code, original DICOM containers and original downloaded image containers are excluded.
