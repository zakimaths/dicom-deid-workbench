# Repeatable privacy-critical browser tests

Roadmap references: A030-A031, A034-A040, A077.

Status: The 0.2.1 browser suite is implemented. Extend it for new workflows; physical touch devices and screen readers remain untested.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Add a pinned lightweight browser test setup and CI that launches the service on an ephemeral loopback port. Cover native imports, public/synthetic examples, numeric and drag masks, pending edits, acknowledgement resets, stale URLs, failures, expiry and actual downloads. Keep all requests local during workflows. Exercise keyboard, touch and narrow layouts.

Check the result: Compare downloaded pixel data through a Python oracle and verify report digest. Prove no stale acknowledgement permits a different export. Test Safari/WebKit explicitly or state the omission. Keep screenshots synthetic and temporary files out of the repository.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
