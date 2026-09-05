# Supported CT/MR object validity

Roadmap references: A012-A016, A065-A067.

Status: Implemented for the limited v2 contract in 0.3.0; full profile review remains outstanding. See ../iod-coverage.md.

## Prompt

Before editing, read the README, SECURITY.md, docs/policy.md, the research roadmap and the relevant tests. Keep the change focused and preserve other work in the repository.

Use synthetic or explicitly permitted public examples. Keep scans, identifiers and OCR text out of external services. Leave source files intact, and keep original values, filenames, identifier mappings and tokens out of reports and logs. Do not relax format checks just to make an example pass.

Describe only what the evidence supports. A successful test does not make the output anonymous, HIPAA compliant, PS3.15 conformant or clinically validated. Publishing code or contacting other people still needs the user's authorisation. A task description is not evidence that the feature has been built.

Task: Pin the DICOM edition and a validator version. Record sanitised baseline failures on synthetic CT/MR and permitted teaching fixtures. Repair required and conditional CT/MR attributes with strict coded-value validation. In particular audit ScanningSequence, SequenceVariant, ScanOptions and MRAcquisitionType. Create a rule table mapping tag/action/condition/source/test. Never invent acquisition facts or blindly retain free text.

Check the result: Add positive and negative cases for VR, VM, missing mandatory attributes, empty Type 2 values and unknown coded terms. Explain every remaining validator finding. Keep full PS3.15 conformance unclaimed until all selected profile and IOD obligations have evidence.

When finished, explain what changed and how it was tested. List the changed files, actual results, remaining limits and what needs to happen next. Include a small synthetic example that someone else can repeat.
