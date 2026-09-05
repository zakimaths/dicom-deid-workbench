# Human-reviewed OCR suggestions

Roadmap references: A037-A040, A043-A048.

Status: Depends on accepted OCR evaluation and the verified redaction backend.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Integrate the evaluated detector as optional local suggestions. The user can inspect, resize, add or discard boxes before applying permanent erasure. Show which boxes are suggestions and which edits were applied. Model installation is explicit; processing makes no network requests. Bound and cancel inference.

Check the result: Test detector failure, partial results, no detections, new image during inference and stale suggestions. Suggestions must never automatically certify complete text cleaning. Reopen and verify the exact final output after user-approved edits.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
