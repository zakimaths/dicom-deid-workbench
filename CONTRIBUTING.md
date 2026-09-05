# Contributing

Start with a synthetic fixture and a failing check. Keep changes small enough to review: finding text, choosing what is sensitive, erasing pixels and validating a saved file are separate jobs.

Never attach patient images, identifiers, OCR strings or re-identification mappings to an issue, pull request or test report. Use the built-in generator to explain a failure. Follow [SECURITY.md](SECURITY.md) for sensitive reports.

Install the locked Python and Node dependencies, then run the checks in the README. A new format needs a documented input contract, positive and negative fixtures, independent DICOM validation and a source/licence record. An OCR change needs development results and one evaluation on the frozen test partition. Do not tune against test results and continue calling it unseen data.

Use clear learner-facing explanations. Every action needs keyboard access and help that works without hover. Test narrow screens and reduced-motion settings. Do not introduce uploads, analytics or externally hosted OCR assets into the public demo.

Useful reviews include anatomy-note corrections with authoritative sources, DICOM rule review and recorded student usability sessions. Record the reviewer's relevant role, scope, date and actual findings with their consent. No expert review or clinical certification is implied by a merged change.
