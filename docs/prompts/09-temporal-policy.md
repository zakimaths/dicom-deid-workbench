# Optional longitudinal research policy

Roadmap references: A060-A063.

Status/dependencies: Depends on batch consistency and an explicit research-use requirement.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Keep date/demographic/device retention off for public teaching by default. If a research use requires it, define a separate versioned policy with recipient risk assumptions, project-scoped date offsets and documented treatment of partial dates, times, ages, sites and devices. Preserve clinically necessary intervals only within scope.

Acceptance criteria: Test leap days, time zones, midnight crossings, partial values and interval invariants across related files. Document residual linkage and distinguish pseudonymisation from anonymity. Never advertise retention as universally stronger privacy.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
