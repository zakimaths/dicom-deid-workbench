# Volume-level defacing feasibility

Roadmap references: A049-A056.

Status/dependencies: Research/validation milestone only until full-volume geometry and format support exist.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Use authorised public or synthetic volumes to evaluate a pinned defacing pipeline for a defined acquisition type. Verify ordering, orientation, spacing and reconstruction first. Document privacy attack model and scientific utility requirements. Include manual QC of every processed test volume and comparisons of downstream measurements.

Acceptance criteria: Publish supported/unsupported acquisitions, residual recognition tests, failures and utility changes with denominators. Do not claim one-slice masking defaces a volume or cite a published error rate as this project's result. No automatic real-data release.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
