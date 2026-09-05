# Supported formats and review status

| Workflow | Input | Result | Limits |
| --- | --- | --- | --- |
| Public teaching exercise | Bundled, licensed teaching pictures only | PNG with live metadata removal, pixel edits and report | Injected fake identifiers only; original source labels and anatomy unassessed |
| Text suggestions | Current teaching picture | Up to 32 reviewable boxes, English Tesseract 7 | Can miss whole labels; no automatic erasure, no patient upload, 30-second bound |
| Local single file | Classic CT/MR Part 10, Explicit VR Little Endian, 16-bit monochrome, single frame, ≤8 MiB, ≤1024² | New DICOM and value-free report | Required geometry and known acquisition codes; strict custom policy, no complete PS3.15 claim |
| Local collection command | 1–512 accepted files, ≤128 MiB total, in one study | Consistent study/series/frame mapping | Duplicate images, mixed studies, conflicting frames and nested or top-level referenced-object sequences rejected; other sequences dropped; no date shifting |
| NIfTI volume viewer | Two curated volumes publicly; locally, scalar 3D NIfTI-1 .nii/.nii.gz, uint8/int16/uint16/float32 | Three slice planes; locally, header-cleaned .nii with reopened-output checks | 32 MiB input, 64 MiB unpacked, 16,777,216 voxels, coded orientation; no defacing, labels, sidecars, BIDS or 4D; [full profile](nifti.md) |
| Local hospital text | UTF-8 TXT/CSV/JSON; unencrypted PDF ≤30 pages; DOCX; ≤8 MiB / 200,000 extracted characters | Reviewed new TXT and counts-only report | Rules plus manual selections; embedded images/attachments/layout omitted; no FHIR or Office/PDF round trip |
| Local hospital pictures | Single PNG/JPEG ≤8 MiB / 2,903,616 pixels | Normalised, metadata-free PNG with verified rectangular replacements | No high-bit-depth, animated or multipage pictures; English OCR suggestions need review; no face detection |
| Annotated text evaluator | Local schema-1 text and independently supplied identifier spans | Per-category/record/subject statistics, intervals, errors, timing and memory | Input is already extracted text; no PDF extraction, OCR, faces or biometric-image accuracy score |
| External corpus runner | Hash-pinned local manifest | Acceptance/rejection counts, timing and traced Python memory | Does not score arbitrary PHI detection; never downloads or republishes scans |

Native X-ray DICOM, compression, enhanced multiframe, colour, LUT/padding workflows and volume defacing are unsupported. The teaching library's X-ray pictures are PNG/JPEG views, not native X-ray DICOM processing.

Anatomy notes are based on cited public sources. Independent clinical review, a recruited learner pilot, installed Safari testing and VoiceOver testing have not yet been recorded. The accessibility report distinguishes automated browser checks from those outstanding reviews.
