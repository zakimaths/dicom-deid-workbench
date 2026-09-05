# Classic CT/MR rule coverage

Standard baseline: DICOM PS3.3 **2026c**, [MR Image Module](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.8.3.html) and [CT Image Module](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.8.2.html). This is a limited supported-object contract, not the full PS3.15 confidentiality profile.

| Fields | Action and condition | Tests |
| --- | --- | --- |
| ScanningSequence (0018,0020), SequenceVariant (0018,0021) | Require nonempty Type 1 on MR; preserve only listed codes; reject unknown codes and unsupported combinations | `test_iod.py`: missing, unknown, incompatible combinations |
| ScanOptions (0018,0022), MRAcquisitionType (0018,0023) | MR only; retain checked codes or empty Type 2 | code and empty-field tests |
| EchoTime, EchoTrainLength, RepetitionTime | Retain numeric or empty; insert empty when unavailable, never invent acquisition facts | empty Type 2 and validator fixtures |
| InversionTime, TriggerTime | Insert empty when IR or cardiac gating condition applies; retain numeric source values | conditional-field tests |
| ImageType | DERIVED/SECONDARY plus a checked source third value; other free text discarded | unknown/missing type tests and validator |
| PositionReferenceIndicator | Empty, never retain arbitrary text | output contract |
| PatientPosition, Laterality | Known codes only, otherwise empty when unknown | code validation; warning recorded |
| AcquisitionNumber, KVP (CT), SeriesNumber, InstanceNumber, SliceThickness | Retain numeric source values; empty Type 2 placeholders where unavailable | numeric contract and validator |
| Geometry and FrameOfReferenceUID | Required, validated representation; frame identifier remapped separately from other UID roles | core and collection tests |
| Study, series, image and frame identifiers | Fresh UIDs with role-specific mapping; collection context shared only inside one bounded run | collision and continuity tests |
| Remaining fields | Existing numerical allowlist / empty identity placeholders / drop unknown, private and sequence trees | core, audit and hidden-channel tests |

## Independent gate on macOS

Download the maintainer's [20260803085716 universal Mac archive](https://www.dclunie.com/dicom3tools/workinprogress/macexe/dicom3tools_macexe_1.00.snapshot.20260803085716.zip). Verify archive SHA-256 `c1d1feb60a1b206862c52db5a4e3115987c134467332f3397957050e4a83e5e1` before extracting it. Do not add binaries or DICOM files to the repository.

```sh
uv run --locked python scripts/validate_iod.py --validator /path/to/dciodvfy
```

The runner requires the pinned version, saves a sanitised JSON record and fails on validator error text or unreviewed warnings. It checks 16 permitted original/redacted outputs and a deliberately broken MR control. It never prints the validator's raw output because that can include source identifiers.

Reviewed warnings: empty identity fields cannot populate a DICOMDIR; laterality is unknown and not guessed from the picture. These warnings remain visible as counts and explanations. External validation is a regression gate, not a runtime dependency or privacy certificate. The output report still says external IOD validation was not performed on an individual user export.
