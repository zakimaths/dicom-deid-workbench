# Volume-level defacing feasibility

Roadmap references: A049-A056.

Status: Research/validation milestone only until full-volume geometry and format support exist.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Use authorised public or synthetic volumes to evaluate a pinned defacing pipeline for a defined acquisition type. Verify ordering, orientation, spacing and reconstruction first. Document privacy attack model and scientific utility requirements. Include manual QC of every processed test volume and comparisons of downstream measurements.

Check the result: Publish supported/unsupported acquisitions, residual recognition tests, failures and utility changes with denominators. Do not claim one-slice masking defaces a volume or cite a published error rate as this project's result. No automatic real-data release.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
