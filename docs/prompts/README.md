# Agent implementation prompts

Use these as bounded tasks. Status descriptions are deliberate: only packages 01 and 02 have an implemented baseline in this increment; the remaining packages are future work. Read the [96-action roadmap](../anonymisation-roadmap.md) first.

- [Saved-output assertions](01-output-contract.md): Implemented baseline in this increment; extend only for new policy changes.
- [Permanent rectangular erasure](02-pixel-redaction.md): Implemented baseline in this increment; expand only within tested formats.
- [Supported CT/MR object validity](03-iod-profile.md): Next priority; depends on a reviewed custom policy and external validator baseline.
- [Hidden identifier trap corpus](04-hidden-channels.md): Can proceed alongside IOD work on a separate test scope.
- [Repeatable privacy-critical browser tests](05-browser-evidence.md): Next priority; depends on stable redaction UI and API.
- [Local OCR evaluation before integration](06-ocr-evaluation.md): Planned; detector choice must follow evaluation, not precede it.
- [Human-reviewed OCR suggestions](07-ocr-review.md): Depends on accepted OCR evaluation and the verified redaction backend.
- [Coherent related-file processing](08-batch-mapping.md): Depends on supported IOD validity and reference-graph tests.
- [Optional longitudinal research policy](09-temporal-policy.md): Depends on batch consistency and an explicit research-use requirement.
- [Volume-level defacing feasibility](10-volume-defacing.md): Research/validation milestone only until full-volume geometry and format support exist.
- [Formal release evidence](11-release-assurance.md): Can proceed independently after defining exact release artifacts.
- [Review for declared identifying pixels](12-quarantined-review.md): Depends on verified editing, revision-bound review and an explicit export gate.
