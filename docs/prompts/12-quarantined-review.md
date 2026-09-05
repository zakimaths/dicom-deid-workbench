# Review for declared identifying pixels

Roadmap references: A032, A037, A081-A084.

Status: Depends on verified editing, revision-bound review and an explicit export gate.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Design a distinct quarantine path for otherwise supported files declaring burned-in identifying text. Inspect locally without offering a normal downloadable export. Keep original flags as risk evidence until a defensible review process assesses all relevant image areas. Model loaded, pending-review, edited, reviewed, failed and expired states separately.

Check the result: Prove direct API calls, stale jobs, empty masks, OCR failures, missing review and interrupted edits cannot obtain a release-labelled output. Do not set BurnedInAnnotation=NO, PatientIdentityRemoved=YES or a Clean Pixel Data conformance code solely because a rectangle was erased. Keep recognisable-feature cases excluded.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
