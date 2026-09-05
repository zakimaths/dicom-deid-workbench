# Permanent rectangular erasure

Roadmap references: A025-A031, A033-A036.

Status: Available in the local tool; keep extensions within tested formats.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Implement source-pixel coordinate rectangles shared by UI and CLI. Replace actual stored pixels using a constant value; handle signed/unsigned and polarity/rescale. Reopen the exported file and independently compare every selected and unselected sample. Add a fake-text fixture. Suspend downloads for pending edits; invalidate old jobs and acknowledgement when applying or failing an edit.

Check the result: Exercise single pixels, edges, overlap, full frame, invalid integers/bools, count/size limits and reversed pointer drags. Inspect the actual downloaded DICOM, not just Canvas. Preserve identifying-pixel flag rejection until a separately designed review quarantine exists.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
