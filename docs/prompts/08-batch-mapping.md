# Coherent related-file processing

Roadmap references: A057-A059, A064, A070.

Status: Bounded single-study mapping delivered in 0.3.0. Reference-bearing collections and wider batch semantics remain unsupported.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Design one bounded batch transaction for supported single-frame files. Map study, series, instance and frame-reference identifiers consistently within that batch using fresh replacements; validate references, duplicates and entity consistency. Keep maps in memory by default and do not expose them in public reports. Handle a failed file without silently exporting an inconsistent set.

Check the result: Use a synthetic multi-study graph with repeated and cross-referenced UIDs. Assert no source instance UID survives, structural class UIDs remain correct, links resolve and repeated source IDs map consistently only within the authorised scope. No global hash of patient identity.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
