# Hidden identifier trap corpus

Roadmap references: A017-A024, A075-A076.

Status/dependencies: Can proceed alongside IOD work on a separate test scope.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Expand synthetic adversarial fixtures across nested sequences, private creators, historical originals, preambles, file metadata, icons, overlays, graphics, unknown/retired tags and misleading source flags. Keep unsupported objects rejected. Search exported DICOM, JSON reports and fixed error responses for planted sentinels. Capture no real PHI.

Acceptance criteria: At least one independently checked regression per hidden channel; valid cases stay valid, unsupported cases fail with bounded, non-sensitive messages. Document structural limits and gaps in parsers rather than claiming an exhaustive malware defence.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
