# Human-reviewed OCR suggestions

Roadmap references: A037-A040, A043-A048.

Status/dependencies: Depends on accepted OCR evaluation and the verified redaction backend.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Integrate the evaluated detector as optional local suggestions. The user can inspect, resize, add or discard boxes before applying permanent erasure. Show which boxes are suggestions and which edits were applied. Model installation is explicit; processing makes no network requests. Bound and cancel inference.

Acceptance criteria: Test detector failure, partial results, no detections, new image during inference and stale suggestions. Suggestions must never automatically certify complete text cleaning. Reopen and verify the exact final output after user-approved edits.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
