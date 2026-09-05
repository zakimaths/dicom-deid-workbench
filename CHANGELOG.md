# Changelog

## Teaching library — 5 September 2026

- Add 50 individually credited, larger MRI/CT/X-ray pictures with anatomy labels, study notes and source/licence links.
- Add search, modality filters, original-contrast viewing, actual size, reset and direct image links in both local and public versions.
- Separate tiny DICOM test fixtures from anatomy teaching images; keep the DICOM import/export support limits unchanged.
- Pin image hashes and add repeatable asset checks plus all-image browser checks, including failed and rapid image selections.

## Browser demo and documentation — 5 September 2026

- Add a GitHub Pages demo with prepared samples, contrast controls, rectangle editing and PNG/report downloads. No processing backend or file upload is deployed.
- Check the static site in Chromium, Firefox and WebKit before publication; publish only the explicit frontend build folder.
- Upgrade pytest from 8.4.2 to 9.0.3 after an advisory scan, pin workflow actions to verified commits, and add dependency advisory checks to CI.
- Add a prominent demo link and clarify the differences between the demo and local DICOM tool.
- Rewrite the public documentation for readability, correct outdated feature descriptions and preserve dated test evidence.


## 0.2.1 - 5 September 2026

- Reject ambiguous identity flags, incorrect value counts/representations, duplicate DICOM attributes, unsupported compression before parsing, and ambiguous HTTP/JSON selections.
- Verify retained field presence and rebuilt file-metadata values after writing.
- Add four pinned public CT/MRI test fixtures, with accurate sources, sizes, preparation and student-friendly help.
- Fit selection defaults to each image; reject blank coordinates, cancel incomplete drawing with Escape, and discard delayed downloads when the image or selection has changed.
- Add checked-in Chromium/Firefox/WebKit flows, independently verified downloads and canvas values, seeded NumPy redaction cases, structural negative tests and maximum-size coverage.

## 0.2.0 - 5 September 2026

- Add rectangle erasing that changes stored pixels, then reopens the file and independently checks the selected and outside pixels.
- Add a repeatable fake-text exercise, drawn or numeric rectangles, paused downloads while edits are pending, and a new acknowledgement after applying an edit.
- Add post-write custom metadata assertions, retained numeric VR checks, report schema 2 and output SHA-256 binding.
- Add CLI region JSON input, research-backed improvement roadmap, assurance matrix and 12 bounded agent prompts.
- Full PS3.15/IOD conformance, automatic text detection, defacing and clinical use remain unsupported. Declared identifying-pixel/recognisable-feature inputs remain unsupported.

## 0.1.0

Initial local metadata workbench, synthetic/public teaching examples, pixel contrast controls and student-friendly explanations.
