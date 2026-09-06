# Experimental mask-guided NIfTI removal

The local NIfTI workspace can prepare a whole-volume face-region removal using a separately reviewed brain mask. It saves a new file, a binary removal map and a check report. The public [NIfTI demo](https://zakimaths.github.io/dicom-deid-workbench/nifti.html) contains a prepared average-head comparison only; it does not accept uploads or run this Python pipeline.

This is a reviewable proposal, not validated hospital anonymisation. The current example leaves some atlas face-region voxels outside the removal. Do not interpret a preserved supplied mask as independently verified brain preservation, or zeroed facial voxels as protection against recognition.

## Use it locally

1. Open a supported structural brain MRI in the local `/nifti` workspace. To practise, choose **Try defacing comparison**, which also loads the supplied atlas brain mask.
2. Supply an independently reviewed binary brain mask on the same grid. In the teaching example, the prepared comparison includes a protected-mask view. For your own files, check mask coverage in an appropriate segmentation viewer before acknowledging it.
3. Choose a 2–20 mm protection margin (default 5). Increasing it leaves more tissue around the supplied mask and can also leave more facial anatomy.
4. Acknowledge the mask review and choose **Prepare removal & verify**. This computes a fresh result locally, even when starting with the teaching example.
5. Compare **Original anatomy**, **After removal**, **Removal area** and **Supplied brain mask**. Slice position, zoom and pan stay linked; before/after anatomy uses the same contrast. Inspect the whole volume in all three directions. Open **Reposition enlarged picture** to pan towards its edges; **Fit whole slice** resets the pan. The **Inspect comparison** shortcut returns focus from the local review section to the picture selector.
6. While viewing the result, acknowledge your review to save the proposal, removal mask and report. A review tick is a user statement, not an automated determination that every slice is safe. Changing the margin, mask or source discards the previous result and ticks.

The original file is never overwritten. Unsupported inputs produce no export. Clear, page exit and the existing ten-minute idle expiry release browser references; processing is stateless on the local server. Memory erasure is not guaranteed by JavaScript or the operating system.

## Supported profile

All existing [NIfTI input limits](nifti.md) apply: NIfTI-1 scalar 3D, millimetres, uint8/int16/uint16/float32, 32 MiB per compressed or plain input and 64 MiB unpacked. Defacing additionally requires:

- Non-negative stored MRI values, with slope 1 and intercept 0. This allows literal zeroing without changing scaling or re-encoding the rest of the image.
- Axis-aligned geometry. Axis permutations, flips and unequal physical spacing are supported; oblique/sheared grids are rejected. No interpolation or resampling of user input occurs.
- Matching scan/mask dimensions and displayed affine, within 0.00001 mm matrix-entry tolerance. If both qform and sform are coded, they must agree within that tolerance. The broader header-only workflow still accepts its documented dual-space cases.
- An unscaled mask containing only 0 and 1, at least 64 occupied voxels, no more than 80% coverage and no occupied outer slice. These are structural guards, not anatomical mask validation.

Automatic segmentation, registration, oblique resampling, partial-field scans, 4D/fMRI, diffusion, CT, non-brain volumes, BIDS sidecars and collections are outside this removal profile. The program does not infer modality or anatomy from filenames or headers; the reviewer must establish that the input fits the intended use.

## Method and verification

Policy `quickshear-physical-v1` adapts the lower-hull construction from Schimke and Hale's [Quickshear work (2011)](https://www.usenix.org/conference/healthsec11/quickshear-defacing-neuroimages). It reorients the mask by axis permutation/flip into right–posterior–superior coordinates, projects the protected brain into a sagittal profile, and builds its lower convex hull in physical millimetres. The first hull edge defines a plane; the margin moves that plane away from the mask. Voxels below the plane are selected across the full left–right extent, then mapped back to the original storage grid.

This is a project implementation, **not the unmodified Quickshear package**. It uses explicit posterior/superior indexing and millimetre distances. Source inspected during implementation: [NIPY Quickshear](https://github.com/nipy/quickshear), source SHA-256 `487defe64360dc33941e5f9e2a7360c2591caa3bcc6264cf525018d73a3b04e8`. The adapted-method attribution and original BSD notice are retained in [licenses/quickshear.txt](licenses/quickshear.txt). No external FSL command, downloaded executable or network service processes inputs. NiBabel 5.3.2 and NumPy 2.2.6 remain locked.

Before returning a result, the pipeline rejects any overlap between removal and the supplied brain mask. It cleans the header, writes the selected stored voxels as zero, reopens the actual output and checks every voxel: outside the region unchanged, inside it zero, and supplied-mask values unchanged. The complete cleaned header is byte-identical before and after removal, preserving geometry, datatype and scaling. A proposal changing no non-zero voxels is rejected.

The report records the policy, margin, full voxel denominator, selected and actually changed counts, changed volume in cubic millimetres, affected slices by **storage axis**, provided-mask count, mask/outside change counts and hashes of both output files. The nested `header` report describes the preceding header-only stage; its unchanged-voxel check and fingerprint refer to that intermediate file, not the defaced output. No source filename or identifying header text enters the report. Geometry and file fingerprints can still be linkable information; the report is not a privacy-safe release certificate.

The local paired-file API uses bounded binary framing, session tokens and same-origin checks. It neither stores a server job nor uses filenames or temporary patient files. The browser checks both returned file hashes and rejects malformed response framing before enabling downloads. A cancelled browser request cannot interrupt a calculation already running in Python, but the obsolete response is discarded and never enabled for export.

## Teaching example and its limits

The source is the [MNI ICBM152 nonlinear asymmetric 2009c atlas](https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009), a population-average anatomical template with supplied brain, face and eye masks. It is **one template**, not a set of independent patient cases. The original [MNI permission notice](../src/dicom_workbench/web/nifti-assets/MNI-LICENSE.txt) ships with the public assets. Atlas publications: [Fonov et al., 2011](https://doi.org/10.1016/j.neuroimage.2010.07.033) and [Fonov et al., 2009](https://doi.org/10.1016/S1053-8119(09)70884-5).

The teaching preparation takes every second voxel in each axis, updates the affine to 2 mm spacing, clips negative T1 intensities to zero, multiplies by ten and rounds to uint16. Mask values are thresholded at 0.5 on the same sampled grid. Fresh valid headers remove source text and normalise unused dimension fields. These deliberate teaching transformations are recorded in `nifti-assets/deface-demo.json`; they are not performed on user inputs by the defacer.

At the default 5 mm margin:

| Measurement | Count |
| --- | ---: |
| Total teaching-copy voxels | 1,082,035 |
| Non-zero voxels changed | 67,221 |
| Changed voxels inside supplied brain mask | 0 |
| Changed voxels outside selection | 0 |
| Supplied atlas face-region voxels selected | 45,724 / 62,236 |
| Supplied atlas face-region voxels outside selection | 16,512 / 62,236 |
| Supplied atlas eye-region voxels selected | 51,410 / 149,166 |
| Supplied atlas eye-region voxels outside selection | 97,756 / 149,166 |

These atlas overlaps are descriptive geometric counts. The eye mask is a broad atlas region, not a precise eyeball segmentation. Neither overlap is privacy recall, recognisability reduction or clinical utility accuracy. No patient-cohort confidence interval or privacy success rate is justified. Facial features, ears, skull shape, labels and anatomy outside the selection can remain; an incomplete supplied brain mask can leave real brain tissue unprotected.

## Reproduce and test

Download the official [2009c archive](https://www.bic.mni.mcgill.ca/~vfonov/icbm/2009/mni_icbm152_nlin_asym_09c_nifti.zip) into ignored `tmp/mni-2009c.zip`. Its SHA-256 must be `804382e5d68a42ff8096ee845a7600b6658434da762fa67840a149eb25d48bd4`.

```sh
uv sync --locked
npm ci --ignore-scripts
PYTHONPATH=src uv run --locked python scripts/build_deface_demo.py tmp/mni-2009c.zip
uv run --locked pytest -q
npm run build:preview
npm run test:nifti
npm run test:nifti-preview
```

The generator checks the archive fingerprint and writes deterministic gzip streams. Tests regenerate the proposal from bundled before/mask bytes and compare exact outputs. Regression cases cover all 48 storage permutations/flips, unequal spacing, supported storage types/byte orders, bad masks, misalignment, scaling, geometry ambiguity, invalid margins and malformed requests. Browser checks cover linked views, review gates, result invalidation, downloaded output hashes, accessibility and mobile widths in Chromium, Firefox and WebKit. An independent byte-level/NumPy verifier checks the nine actual local downloads against original voxels and the supplied mask without calling the defacing code or NiBabel.

This remains software verification and a teaching example. Next work needs independently reviewed anatomical masks and diverse permitted structural MRIs, full-volume human QC, recognition/re-identification evaluation, and scientific utility measurements outside the protected mask. Physical-device and assistive-technology testing also remain outstanding.

See the [dated verification record](nifti-defacing-validation-2026-09-06.md) for executed checks and their limits.
