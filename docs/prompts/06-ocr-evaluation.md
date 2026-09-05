# Local OCR evaluation before integration

Roadmap references: A041-A048.

Status: Planned; detector choice must follow evaluation, not precede it.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Build an original labelled text corpus with known boxes, fonts, sizes, rotations, languages, corners/interiors, contrast/polarity and fake identifier types. Compare two local CPU-compatible detection approaches after verifying current licensing and Mac support. Pin software/models/weights and separate tuning from a held-out test set.

Check the result: Report image-level and identifier-level misses, box coverage, excess masking, denominators, hardware, runtime and memory. Detector absence/timeout/failure remain unresolved. Do not persist recognised strings or equate no detections with safe pixels.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
