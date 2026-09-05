# NIfTI volumes

[Try the public volume viewer](https://zakimaths.github.io/dicom-deid-workbench/nifti.html), or open `/nifti` in the local application to inspect and clean an authorised file.

The public viewer includes a real brain MRI and an asymmetric block fixture. Choose axial, coronal or sagittal slices, move one slice at a time, zoom out or in, fit the whole slice, and adjust contrast. Directions are written beside the picture and in the controls. Radiological views put the person's right on the picture's left; the sagittal view puts the front of the person on the left. Viewing controls do not change exported voxels.

## Local header cleaning

Import a file, inspect the header findings, then choose **Clean header & verify**. Saving requires acknowledging that anatomy, visible labels and accompanying files remain unassessed, and that removing extensions is appropriate. The result is a new uncompressed `header-cleaned.nii`, plus an optional value-free JSON check report. The source is never overwritten.

Supported input is single-file NIfTI-1 (`.nii` or one `.nii.gz` stream), scalar 3D, with uint8, int16, uint16 or float32 voxels. Both byte orders are tested. A coded, valid orientation and millimetre spatial units are required. Metre/micron volumes are rejected rather than mislabelled as millimetres in this viewer. Different valid qform/sform spaces are preserved; contradictory handedness is rejected. Specialised intents, NIfTI-2, paired headers/images, 4D, complex/vector data, non-finite voxels, unknown orientation and damaged input are rejected.

The pinned viewer uses qform when its code is higher than sform's, and sform otherwise. The reported axes follow that display choice; both original transforms remain in the saved file. After loading, the viewer's actual transform and intensity scaling must agree with the independently checked values. A mismatch blocks viewing and export rather than allowing the library to silently repair or reinterpret the file.

Limits: 32 MiB input; 64 MiB unpacked; 16,777,216 voxels; each dimension at most 512; header/extensions at most 1 MiB. These are bounded prototype limits, not guarantees about available memory on every phone. The gzip reader enforces the unpacked limit during decompression, rejects concatenated members and checks stream completion.

Policy `nifti1-scalar3d-header-v1` reconstructs the header from allowed numeric interpretation fields. It removes `descrip`, `aux_file`, `intent_name`, unused header bytes, all extensions, extra padding and trailing content. Writing a plain `.nii` also avoids carrying over gzip filenames, comments, extra fields or source timestamps. Extension removal can lose scientific information: this is intentionally a limited profile, not a general NIfTI or BIDS preservation tool.

The actual serialised output is reopened with NiBabel. Raw voxel values, scaling, dimensions, spacing, units, both coordinate matrices and their codes are compared. The browser checks the returned file against the verified output fingerprint before enabling download. CI also inspects actual browser downloads with explicit header parsing and independently constructed NumPy voxel expectations.

**This does not deface a scan, remove visible labels, assess other files or establish anonymity.** No anatomy, diagnosis or patient identity is inferred from the file name. The check report names fields and records counts, geometry, policy and an output fingerprint; it contains no original filename or header text.

## Local and public boundaries

The local endpoints require the existing same-origin and session-token checks. Processing is stateless: source bytes are not placed in server jobs, logs or disk caches. The browser releases its volume and output on Clear, cancellation, page exit or ten minutes without interaction. JavaScript cannot guarantee forensic erasure of browser or operating-system memory.

The Pages build removes file import and cleaning controls and does not ship the local controller or Python service. Only the two curated, checksum-verified volumes can be selected. NiiVue 0.69.0 is vendored as a pinned, self-contained module; no CDN is used. Its embedded font images require `data:` image permission on the volume page. No external requests or API calls are needed by the public NIfTI viewer after the same-origin assets load.

## Teaching sources

**Brain MRI:** Gorgolewski KJ, Storkey A, Bastin ME, Whittle IR, Wardlaw JM and Pernet CR, *A test-retest fMRI dataset for motor, language and spatial attention functions*, OpenNeuro **ds000114 v1.0.2**, [DOI](https://doi.org/10.18112/openneuro.ds000114.v1.0.2). The [dataset declaration](https://raw.githubusercontent.com/OpenNeuroDatasets/ds000114/master/dataset_description.json) states **CC0**. Source object: `sub-01/ses-test/anat/sub-01_ses-test_T1w.nii.gz`. The source has visibly altered facial regions; the teaching notes explain that these are not normal anatomy. This is not an independent defacing certification.

The bundled teaching copy takes every second voxel along each spatial axis using NiBabel's image slicer (128 × 78 × 128), updates the affine accordingly, then applies the header policy. It is a genuine volume, not a stack assembled from teaching JPEGs. This deliberate teaching downsampling is separate from local header cleaning, which preserves every voxel. Exact source URL, source hashes, output hash and preparation are in `src/dicom_workbench/web/nifti-assets/samples.json`.

**Orientation fixture:** deterministic synthetic blocks with unequal spacing, a brighter right-hand block, three fake text fields and a fake extension. MIT-licensed project code generates it; it has no patient or anatomical data.

## Reproduce

```sh
uv sync --locked
npm ci --ignore-scripts
uv run --locked pytest -q tests/test_nifti.py tests/test_server.py tests/test_preview_build.py
npm run build:preview
npm run test:nifti
npm run test:nifti-preview
```

`test:nifti` checks the local workflow in Chromium, Firefox and WebKit at 1280, 390 and 320 pixels wide, then independently verifies nine downloads. `test:nifti-preview` checks public navigation, both samples, missing local import/export controls, corrupted-sample rejection, same-origin requests and accessibility in all three engines at desktop and 320 pixels. Reports and screenshots go under `output/nifti-browser` and `output/nifti-preview`.

Rebuild the viewer with `node scripts/vendor_nifti.mjs` after installing the exact lock. For teaching-asset regeneration, download the recorded source object into the ignored `tmp/` directory, then run `PYTHONPATH=src uv run --locked python scripts/build_nifti_samples.py tmp/openneuro-t1.nii.gz`. The script checks the source before generating assets. Do not substitute hospital data into this public build script.

## Remaining work

Defacing, BIDS collection review, 4D, complete-series conversion and independent clinical/privacy evaluation remain separate stages. Automated accessibility and browser emulation do not replace installed Safari, physical iPhone/iPad, VoiceOver/TalkBack or usability review. WebGL2 is required; unavailable graphics produce a recoverable error instead of an export. See the [supported-format contract](supported-formats.md).
