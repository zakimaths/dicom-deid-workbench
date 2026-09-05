# Release checks

- [ ] Update package, interface and citation versions; record the tested revision.
- [ ] Locked Python tests, JavaScript tests and lint pass.
- [ ] Run the independent validator on original and redacted permitted fixtures; fail on error text even when exit status is zero. Review new warnings.
- [ ] Run the 50-picture PNG export regression on Chromium, Firefox and WebKit.
- [ ] Run automated accessibility scans, keyboard tasks, narrow-screen checks and reduced-motion checks. Review inconclusive scan findings.
- [ ] Record OCR misses, innocent-text erasure, denominators, settings and failed/unavailable cases. Never convert an empty OCR result into clearance.
- [ ] Verify saved PNGs independently, including corrupted and partial-erasure controls.
- [ ] Rebuild the static artifact twice. Check its allowlist, CSP, OCR asset hashes and dependency advisories.
- [ ] Generate SBOM and signed build provenance in CI. Retain alongside the artifact.
- [ ] Record expert anatomy/DICOM review and learner/assistive-technology reviews when actually performed; otherwise leave outstanding.
- [ ] Review documentation and screenshots for unsupported accuracy or clinical claims.

The static demo remains sample-only. Keep new studies, compressed DICOM and full-volume defacing behind separate tested support decisions. A signed build proves provenance, not privacy.
