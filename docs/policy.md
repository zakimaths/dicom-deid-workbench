# Policy: single-frame-metadata-v1

The local tool keeps a short list of imaging fields and removes or replaces the rest. The rules live in `src/dicom_workbench/core.py`. They cover a limited teaching workflow, not the full DICOM confidentiality profile or every requirement of a CT/MR object. The public browser demo shows reports prepared with these rules; it does not run them on uploads.

| Input category | Operation |
| --- | --- |
| Selected numeric imaging fields | Keep; reject non-finite or out-of-range numeric values |
| Pixel Data | Preserve exactly unless the user applies a verified rectangle edit |
| SOP Class, modality, photometric interpretation | Keep only supported enumerated values |
| Patient name/ID/birth date/sex, study date/time, accession, referring physician, study ID, manufacturer | Empty |
| Instance/study/series/frame-of-reference UIDs | Fresh random replacement per file, coherent for repeated values within that file |
| All sequences, including private/nested content | Remove entire tree; no cross-file references retained |
| Every other source field, including private fields and arbitrary descriptions | Remove |
| Preamble and file metadata | Rebuild; do not carry source application fields |
| Image type, derivation description and method | Replace/add fixed application values |
| CT RescaleType | Only HU accepted; replace with fixed HU |

The action list describes operations on source top-level fields. A removed sequence counts as one source field, even if it contains many nested elements. Fixed added fields and rebuilt file metadata are described separately. Empty required identity fields are added even if absent in the source.

No `PatientIdentityRemoved=YES`, Clean Pixel Data code or `BurnedInAnnotation=NO` assertion is added. Known positive identifying-pixel flags are rejected. Other accepted inputs retain an unresolved pixel-risk status.

## What these rules leave out

Some discarded metadata may be required by a particular CT/MR IOD or needed for scientific use. `dcmread` and successful rendering do not establish complete conformance. Required-field validation with an independent validator is a future milestone. The result is useful for inspecting the experiment, but it is unsuitable for clinical exchange.

Processing each file separately creates separate study/series pseudonyms. This version must not be used as a series anonymiser. Recognisable anatomy, pixel text, image matching and numeric metadata fingerprinting remain unaddressed.

## References

- [DICOM PS3.15 Annex E](https://dicom.nema.org/medical/dicom/current/output/chtml/part15/chapter_E.html): distinction between attribute transformation and full-object confidentiality; consulted 5 September 2026 (live edition 2026c).
- [DICOM Clean Pixel Data](https://dicom.nema.org/medical/dicom/current/output/chtml/part15/sect_E.3.html): pixel identity needs separate treatment.
- [DICOM VOI LINEAR function](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.11.2.html): numerical reference for the browser's window/level function.

## Pixel editing and saved-output checks

The metadata subset itself remains v1. Retained numeric fields now require their expected dictionary VR, and a post-write assertion layer checks that the custom output contract held. This layer uses pydicom and the declared policy; it is not independent IOD certification.

Optional `stored-rectangles-v1` replaces a bounded set of source-coordinate rectangles with a constant stored endpoint selected for pixel polarity and rescale sign. It independently decodes the saved samples and checks every inside/outside pixel. Report schema 2 records the selection, fill value, selected/changed counts, output digest and residual assessment. No whole-image-clean DICOM marker is added. Existing positive identifying-pixel flags still cause rejection.

## Additional checks in 0.2.1

Before parsing, a bounded Explicit VR Little Endian structural check rejects repeated/out-of-order attributes, malformed lengths/delimiters and unsupported transfer syntax. Numeric multiplicities and image-control representations are validated before interpreting them. Identity declarations must be scalar YES or NO when present; absent declarations remain unassessed. Window centers and widths must pair up, and every width must be valid. Output verification requires all retained fields and the expected rebuilt file-meta values. These checks strengthen the same limited policy; they do not add full IOD or PS3.15 conformance.
