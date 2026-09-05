# Formal release evidence

Roadmap references: A078-A080, A089-A096.

Status: Can proceed independently after defining exact release artifacts.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Create a threat model, risk register, requirement-to-test matrix, changelog, supported-version policy and evidence bundle. Audit CI privilege and pin action revisions after verifying sources. Add a licence/component inventory, dependency scanning, package checksums and provenance verification instructions. Separate semantic output repeatability from byte-identical builds.

Check the result: Build from a clean checkout on the stated Mac/Linux targets, verify expected provenance and artifact digests, and document every untested platform/tool. Do not change branch protection or account settings without appropriate authorisation. No certification badges based only on CI.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
