# Supported CT/MR object validity

Roadmap references: A012-A016, A065-A067.

Status/dependencies: Next priority; depends on a reviewed custom policy and external validator baseline.

## Prompt

Read the repository README, SECURITY.md, docs/policy.md, docs/anonymisation-roadmap.md and relevant tests before editing. Preserve unrelated changes. Use synthetic or explicitly permitted public data only. Do not send scans, identifiers or OCR text to external services. Do not weaken format validation to make a fixture pass. Do not label an output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated without the specific evidence required for that claim. Keep source files intact and keep original values, filenames, UID mappings and tokens out of reports/logs. Work in one bounded branch or change set; do not publish or contact others unless the user has authorised it. Run relevant checks and return changed files, evidence, remaining limitations and the next dependency. Do not mark a planned feature complete merely because its prompt exists.

Your task: Pin the DICOM edition and a validator version. Record sanitised baseline failures on synthetic CT/MR and permitted teaching fixtures. Repair required and conditional CT/MR attributes with strict coded-value validation. In particular audit ScanningSequence, SequenceVariant, ScanOptions and MRAcquisitionType. Create a rule table mapping tag/action/condition/source/test. Never invent acquisition facts or blindly retain free text.

Acceptance criteria: Add positive and negative cases for VR, VM, missing mandatory attributes, empty Type 2 values and unknown coded terms. Explain every remaining validator finding. Keep full PS3.15 conformance unclaimed until all selected profile and IOD obligations have evidence.

Handoff: state the concrete before/after behaviour, tests and their actual outcomes, privacy claims that remain unsupported, changed files and the next dependency. Include a minimal reproduction with synthetic data.
