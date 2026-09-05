# Hidden identifier trap corpus

Roadmap references: A017-A024, A075-A076.

Status: Can proceed alongside IOD work on a separate test scope.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Expand synthetic adversarial fixtures across nested sequences, private creators, historical originals, preambles, file metadata, icons, overlays, graphics, unknown/retired tags and misleading source flags. Keep unsupported objects rejected. Search exported DICOM, JSON reports and fixed error responses for planted sentinels. Capture no real PHI.

Check the result: At least one independently checked regression per hidden channel; valid cases stay valid, unsupported cases fail with bounded, non-sensitive messages. Document structural limits and gaps in parsers rather than claiming an exhaustive malware defence.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
