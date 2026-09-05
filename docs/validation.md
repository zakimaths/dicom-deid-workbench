# Validation of v0.1

Tests are evidence for the declared narrow scope, not a certification. All test and screenshot data comes from generated geometry with fake identifiers.

## Automated checks

- Python tests exercise identifier removal, nested/private sequence removal, output pixel arrays (independently decoded with pydicom/NumPy), new IDs, file metadata, unsupported inputs, CLI overwrite prevention, local HTTP access controls, downloads, expiry and invalidation after failed imports.
- Seven Node built-in tests check the browser's DICOM LINEAR boundaries, width-one threshold, MONOCHROME1 inversion, signed/unsigned little-endian decoding, rescale and RGBA output. No npm packages are needed.
- A reproduction script emits fixture, pixel and report hashes. Random output UIDs are intentionally excluded from deterministic hash comparisons.
- GitHub Actions runs the Python suite on Linux, macOS arm64 and macOS Intel. See the actual run for the release commit; runner images can change even with named OS labels.

## Local verification

Development environment: macOS 26.6.2, arm64, Python 3.12.11, pydicom 3.0.2. All **29 Python tests** and **7 JavaScript tests** passed. Ruff reported no issues.

Chromium 152 was used for browser review at 1440 × 1150 and 390 × 844. The synthetic example rendered, window adjustment and reset worked, the acknowledgement enabled export, and the browser-downloaded DICOM reopened with unchanged pixels and an empty patient name. There was no horizontal overflow at either width and no browser console errors. A clean source-archive installation successfully ran the fixture command; the wheel includes the UI assets.

## What is not established

No real patient data, external clinical datasets, MIDI benchmark run, full IOD validator, formal PS3.15 evaluation, Safari certification, calibrated medical display assessment or clinical workflow study is included. Independent series integrity and compressed-format checks do not apply because those features are unsupported.

## Reproducing an issue

Use `dicom-workbench fixture` and modify only fake fields. State the source commit, operating system, architecture, Python/browser version, command and expected behaviour. Never attach patient data to an issue.

## Public samples and student help (September 2026)

37 Python tests and 7 JavaScript pixel tests pass locally on macOS. New tests pin the two upstream scan hashes, compare prepared metadata element by element, preserve original pixel bytes through scrubbing, and check sample endpoint authentication, invalid identifiers, downloads and clearing. The source and wheel builds pass.

Chromium checks cover opening both samples, switching back to the synthetic example, resetting acknowledgement on a new image, and downloading/reopening the CT output. Hover help, keyboard focus, Escape dismissal, moving the pointer onto a help bubble, disabled-control help and the touch-friendly guide were exercised. Screens at 320, 390, 768 and 1440 pixels have no page-wide horizontal overflow. No external requests or browser JavaScript errors occurred. Safari, Firefox and a screen reader were not tested.
