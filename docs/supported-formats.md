# Supported formats and review status

| Workflow | Input | Result | Limits |
| --- | --- | --- | --- |
| Public teaching exercise | Bundled, licensed teaching pictures only | PNG with live metadata removal, pixel edits and report | Injected fake identifiers only; original source labels and anatomy unassessed |
| Text suggestions | Current teaching picture | Up to 32 reviewable boxes, English Tesseract 7 | Can miss whole labels; no automatic erasure, no patient upload, 30-second bound |
| Local single file | Classic CT/MR Part 10, Explicit VR Little Endian, 16-bit monochrome, single frame, ≤8 MiB, ≤1024² | New DICOM and value-free report | Required geometry and known acquisition codes; strict custom policy, no complete PS3.15 claim |
| Local collection command | 1–16 accepted files in one study | Consistent study/series/frame mapping | Duplicate images, mixed studies, conflicting frames and top-level referenced-object sequences rejected; other sequences dropped; no date shifting |
| External corpus runner | Hash-pinned local manifest | Acceptance/rejection counts, timing and traced Python memory | Does not score arbitrary PHI detection; never downloads or republishes scans |

Native X-ray DICOM, compression, enhanced multiframe, colour, LUT/padding workflows and volume defacing are unsupported. The teaching library's X-ray pictures are PNG/JPEG views, not native X-ray DICOM processing.

Anatomy notes are based on cited public sources. Independent clinical review, a recruited learner pilot, installed Safari testing and VoiceOver testing have not yet been recorded. The accessibility report distinguishes automated browser checks from those outstanding reviews.
