# Permanent rectangular erasure

Roadmap references: A025-A031, A033-A036.

Status/dependencies: Implemented baseline in this increment; expand only within tested formats.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Implement source-pixel coordinate rectangles shared by UI and CLI. Replace actual stored pixels using a constant value; handle signed/unsigned and polarity/rescale. Reopen the exported file and independently compare every selected and unselected sample. Add a fake-text fixture. Suspend downloads for pending edits; invalidate old jobs and acknowledgement when applying or failing an edit.

Acceptance criteria: Exercise single pixels, edges, overlap, full frame, invalid integers/bools, count/size limits and reversed pointer drags. Inspect the actual downloaded DICOM, not just Canvas. Preserve identifying-pixel flag rejection until a separately designed review quarantine exists.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
