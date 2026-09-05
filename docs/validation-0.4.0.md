# Validation record — 0.4.0

Run on 5 September 2026, macOS ARM64, Python 3.12.11, Node 26.7.0.

- 227 Python tests, including 39 hospital-text/document/statistics cases and 50 hospital-DICOM regression cases.
- 16 JavaScript pixel, PNG and challenge unit tests.
- Six complete local hospital-record flows: Chromium, Firefox and WebKit, at 1440 and 390 pixels. Imported UTF-8 text and PNG files; selected Unicode text manually across Windows CRLF line endings; preserved manual selections when suggesting again; checked downloaded TXT and every pixel in saved PNGs; exercised full-size viewing and malformed-import recovery.
- Three real OCR runs in the local picture workflow; workers terminated after each run. OCR accuracy remains limited as recorded in the earlier benchmark.
- Eighteen axe WCAG A/AA states with zero automated violations. No VoiceOver or physical-touch evaluation is claimed.
- Delayed image-hash regression confirms clearing the record cannot repopulate a stale export.
- Existing local DICOM/browser and public preview flows pass in all three engines; the 50 teaching images still load. Twenty-one browser DICOM exports passed independent pydicom/NumPy checks.
- Sixteen independent `dciodvfy` fixture export checks pass, plus the negative control.
- Python and npm dependency audits report no known advisories for the locked dependencies at this run.
- Static build remains exactly 136 allowlisted frontend assets. Hospital-record readers, routes and file uploads are excluded from the public deployment.

The reproducible [840-record text regression](hospital-records.md#recorded-run-5-september-2026) includes failures: 30 narrative-name misses in each partition. Passing software tests means expected behavior was verified, including known limitations; it does not mean every identifier was found. The [compact numerical report](evaluation-0.4.0.json) retains category results, denominators, confidence intervals and provenance. Full case records and browser results are CI artifacts.

Material defects caught during implementation: apostrophes in labelled values; an empty labelled field consuming the next line; macOS rejecting Linux-style address-space limits; loss of manual text selections on re-suggestion; missing visual rectangle outlines/full-size inspection; a clear/export timing race; Windows line endings shifting a manual selection and leaving a trailing name character; an undersized home-page setup link caught by the deployment accessibility gate. Each was corrected, with regression checks for data or state behavior. Native X-ray/compressed/multiframe DICOM, unrestricted narrative detection, full-document PDF/Office round trips and external clinical accuracy remain unimplemented or unvalidated, as described in the support contract.
