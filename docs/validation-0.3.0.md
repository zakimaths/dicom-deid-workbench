# 0.3.0 validation - 5 September 2026

Local environment: macOS 26.6.2 ARM64, Python 3.12.11, pydicom 3.0.2, Playwright 1.62.1. Versions and dependency integrity are locked. CI repeats the platform matrix; local results below do not claim that a future hosted run has already passed.

| Check | Result |
| --- | --- |
| Python regression suite | 135 passed in the full run; one additional post-write Type 2 failure test passed in the final targeted pass (136 cases total) |
| JavaScript math, PNG integrity and challenge scoring | 16 passed |
| Ruff | Passed |
| Guided PNG export regression | 50 teaching pictures × 3 engines = 150 runs; decoded saved pixels and metadata checked independently |
| Existing static-preview suite | Passed in Chromium, Firefox and WebKit, including all 50 library entries, filters, corruption/races and export flows |
| Existing local browser suite | Passed in all 3 engines; 21 downloaded DICOM exports and public-sample previews independently checked with pydicom/NumPy |
| New accessibility/interaction suite | 27 axe scans at 1440px/390px; no automated WCAG-tagged violations; reviewed decorative-icon contrast uncertainty |
| OCR lifecycle | Success, user cancellation and 1ms startup timeout leave no active worker; all 3 engines |
| Independent DICOM validator | 16/16 preserve/redact fixture cases passed; missing-MR-field negative control caught; known warnings recorded |
| Synthetic OCR benchmark | Test: 8/20 injected identifiers missed; 2/6 image failures. Empty detections are unresolved |
| Local public-format corpus | 14 prepared/raw format variants: 7 accepted, 7 rejected; full denominator retained; not 14 independent patients |
| Single-study CLI | Two synthetic instances exported with shared study/series/frame mappings; unit cases cover duplicate/mixed-study rejection and UID-role collisions |
| Repeatability | Static build hashes repeat, fixture/pixel digests stable, random DICOM output IDs intentionally differ |
| Dependency advisories | npm and locked pip-audit reported no known vulnerabilities at this check |
| Supply-chain evidence | SPDX SBOM generated locally; pinned CI action added for signed build provenance |

## Defects caught and repaired

- Required classic MR acquisition fields and several CT/MR placeholders were lost by the old allowlist.
- Legacy MR fixtures reused a UID for study and coordinate frame. Role-specific mappings prevent carrying that collision into exports.
- Empty required Type 2 numeric fields were incorrectly rejected. Nonempty values still require the existing strict VR/VM/numeric checks.
- The validator can emit error text with exit code zero; the gate now examines both.
- Disabled-button help spans lacked an appropriate named role for assistive technology.
- OCR initialization could outlive cancellation when waiting for a model. A small pinned worker-protocol adapter now owns and terminates the worker from startup.
- The old fake-text launcher was missing from teaching-mode isolation; it now follows the same protected switch as the other sample buttons.

## Limits

These checks establish a bounded implementation contract and reproducible failures, not clinical anonymity, full PS3.15 conformance, universal DICOM interoperability or WCAG certification. The OCR corpus is small, synthetic and English-only. Source text, faces and recognisable anatomy remain unassessed. MIDI-B answer-key scoring, independent clinician/anatomy review, recruited learner sessions, actual VoiceOver listening, installed Safari and physical-device testing have not been performed.

See [implementation status](implementation-status.md), [accessibility](accessibility.md), [benchmark method](benchmarks.md) and [IOD coverage](iod-coverage.md). Generated raw test artifacts remain in ignored `output/`; CI uploads sanitised reports and the static frontend separately.
