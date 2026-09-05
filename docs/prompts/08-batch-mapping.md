# Coherent related-file processing

Roadmap references: A057-A059, A064, A070.

Status/dependencies: Depends on supported IOD validity and reference-graph tests.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Design one bounded batch transaction for supported single-frame files. Map study, series, instance and frame-reference identifiers consistently within that batch using fresh replacements; validate references, duplicates and entity consistency. Keep maps in memory by default and do not expose them in public reports. Handle a failed file without silently exporting an inconsistent set.

Acceptance criteria: Use a synthetic multi-study graph with repeated and cross-referenced UIDs. Assert no source instance UID survives, structural class UIDs remain correct, links resolve and repeated source IDs map consistently only within the authorised scope. No global hash of patient identity.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
