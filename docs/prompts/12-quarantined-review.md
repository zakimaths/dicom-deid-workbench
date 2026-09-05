# Review for declared identifying pixels

Roadmap references: A032, A037, A081-A084.

Status/dependencies: Depends on verified editing, revision-bound review and an explicit export gate.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Design a distinct quarantine path for otherwise supported files declaring burned-in identifying text. Inspect locally without offering a normal downloadable export. Keep original flags as risk evidence until a defensible review process assesses all relevant image areas. Model loaded, pending-review, edited, reviewed, failed and expired states separately.

Acceptance criteria: Prove direct API calls, stale jobs, empty masks, OCR failures, missing review and interrupted edits cannot obtain a release-labelled output. Do not set BurnedInAnnotation=NO, PatientIdentityRemoved=YES or a Clean Pixel Data conformance code solely because a rectangle was erased. Keep recognisable-feature cases excluded.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
