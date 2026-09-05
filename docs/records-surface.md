# Local records surface

`/records` is an **operate** surface: open a record, inspect proposed removals, apply them, review the resulting copy and save it. It serves the user's request to work with hospital documents and ordinary pictures locally. It inherits the existing **Arcade Terminal** direction from `DESIGN.md`; it does not introduce a new visual system or change its global tokens.

## Layout and interaction

The page uses the incumbent dark surfaces, square controls, local monospaced fonts and written status messages. A centred column, capped at 1120px, keeps the import, editing and export steps in reading order. Actions wrap on smaller screens, and buttons have at least 44px height. Amber status text names the condition rather than leaving colour to explain it.

Original extracted text and the resulting copy have separate, labelled read-only fields. Suggestions appear in an expandable list with a “Keep passage” action for each entry. Reviewers can enter known identifiers or select text directly; rerunning suggestions preserves manual selections. Plain-language explanations accompany the controls.

Picture review offers fit-to-screen and full-size viewing in a focusable scroll area. Numbered outlines correspond to removable entries in the rectangle list. Numeric fields provide a keyboard route for defining boxes. Applied regions become opaque black; outlines are editing aids and do not enter the saved picture.

Edits invalidate the previous export and clear its review acknowledgements. Saving requires a verified result and both privacy and usefulness acknowledgements. Clearing a record also cancels OCR and prevents an older operation from restoring the cleared content. There is no automatic saving; ten minutes without interaction clears the tab's record. This is session cleanup, not a secure-memory-erasure guarantee.

## Import and export contract

- TXT, CSV, JSON, PDF and DOCX yield review text and export a fresh TXT file. Rules suggest labelled identifiers and common patterns; known-value matching and manual selection supplement them. General name recognition and coverage of all languages are not implemented.
- PDF extraction omits pictures, handwriting, attachments, annotations and layout; pages without extractable text are rejected. DOCX includes available text from headers, footers, comments and revisions, while omitting images, embedded files and layout. Reviewers must compare the extract with the original for missing information.
- CSV rows become labelled text; JSON keys and values become formatted text. Exports are neither spreadsheets nor validated FHIR resources.
- PNG and JPEG imports produce a new PNG with inherited metadata removed, orientation normalised and transparency flattened. Large, animated and high-bit-depth pictures are rejected. Pixel verification uses that normalised picture as its baseline, not the original file bytes.
- OCR offers local English text suggestions. Empty detections are unresolved. Selected pixels are checked after reopening the saved PNG, but faces, anatomy and undetected labels remain outside that proof.

The processing report excludes original values and filenames. Its counts measure operations, not detection accuracy; accuracy needs separate ground truth. Review ticks are acknowledgements, not clinical approval or anonymity certification.

This page is served by the loopback application only. The public sample site links to local setup and accepts no hospital-file uploads. DICOM remains in its existing workbench with its documented classic CT/MR limits; supported single-study collections are bounded at 512 files and 128 MiB.
