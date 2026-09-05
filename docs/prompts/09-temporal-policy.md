# Optional longitudinal research policy

Roadmap references: A060-A063.

Status: Depends on batch consistency and an explicit research-use requirement.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Keep date/demographic/device retention off for public teaching by default. If a research use requires it, define a separate versioned policy with recipient risk assumptions, project-scoped date offsets and documented treatment of partial dates, times, ages, sites and devices. Preserve clinically necessary intervals only within scope.

Check the result: Test leap days, time zones, midnight crossings, partial values and interval invariants across related files. Document residual linkage and distinguish pseudonymisation from anonymity. Never advertise retention as universally stronger privacy.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
