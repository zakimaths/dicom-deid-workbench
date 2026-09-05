# Formal release evidence

Roadmap references: A078-A080, A089-A096.

Status/dependencies: Can proceed independently after defining exact release artifacts.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Create a threat model, risk register, requirement-to-test matrix, changelog, supported-version policy and evidence bundle. Audit CI privilege and pin action revisions after verifying sources. Add a licence/component inventory, dependency scanning, package checksums and provenance verification instructions. Separate semantic output repeatability from byte-identical builds.

Acceptance criteria: Build from a clean checkout on the stated Mac/Linux targets, verify expected provenance and artifact digests, and document every untested platform/tool. Do not change branch protection or account settings without appropriate authorisation. No certification badges based only on CI.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
