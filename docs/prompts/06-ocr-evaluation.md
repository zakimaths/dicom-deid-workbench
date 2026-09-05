# Local OCR evaluation before integration

Roadmap references: A041-A048.

Status/dependencies: Planned; detector choice must follow evaluation, not precede it.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Build an original labelled text corpus with known boxes, fonts, sizes, rotations, languages, corners/interiors, contrast/polarity and fake identifier types. Compare two local CPU-compatible detection approaches after verifying current licensing and Mac support. Pin software/models/weights and separate tuning from a held-out test set.

Acceptance criteria: Report image-level and identifier-level misses, box coverage, excess masking, denominators, hardware, runtime and memory. Detector absence/timeout/failure remain unresolved. Do not persist recognised strings or equate no detections with safe pixels.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
