# Saved-output assertions

Roadmap references: A009-A011, A074, A089.

Status: Available in the local tool; extend when the policy changes.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Add or audit a versioned report contract that distinguishes custom metadata verification, selected pixel edits, external IOD validation and remaining risk. Verify the exact serialized output; check no unexpected/private/sequence fields, nonempty identity placeholders, original instance UIDs or contaminated file metadata survive. Bind report to output digest. Use independent mutation tests and preserve semantic reproducibility despite fresh production UIDs.

Check the result: Inject forbidden fields, wrong VRs, source UIDs and changed pixel buffers. Every injected fault must fail closed. A successful custom check must still report IOD validation as not performed. Never implement the verifier as a call back into the writer.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
