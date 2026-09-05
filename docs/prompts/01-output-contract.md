# Saved-output assertions

Roadmap references: A009-A011, A074, A089.

Status/dependencies: Implemented baseline in this increment; extend only for new policy changes.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Add or audit a versioned report contract that distinguishes custom metadata verification, selected pixel edits, external IOD validation and remaining risk. Verify the exact serialized output; check no unexpected/private/sequence fields, nonempty identity placeholders, original instance UIDs or contaminated file metadata survive. Bind report to output digest. Use independent mutation tests and preserve semantic reproducibility despite fresh production UIDs.

Acceptance criteria: Inject forbidden fields, wrong VRs, source UIDs and changed pixel buffers. Every injected fault must fail closed. A successful custom check must still report IOD validation as not performed. Never implement the verifier as a call back into the writer.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
