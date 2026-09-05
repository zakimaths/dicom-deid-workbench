# Repeatable privacy-critical browser tests

Roadmap references: A030-A031, A034-A040, A077.

Status/dependencies: Next priority; depends on stable redaction UI and API.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Add a pinned lightweight browser test setup and CI that launches the service on an ephemeral loopback port. Cover native imports, public/synthetic examples, numeric and drag masks, pending edits, acknowledgement resets, stale URLs, failures, expiry and actual downloads. Keep all requests local during workflows. Exercise keyboard, touch and narrow layouts.

Acceptance criteria: Compare downloaded pixel data through a Python oracle and verify report digest. Prove no stale acknowledgement permits a different export. Test Safari/WebKit explicitly or state the omission. Keep screenshots synthetic and temporary files out of the repository.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
