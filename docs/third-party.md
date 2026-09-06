# Third-party browser assets

OCR is supplied by Tesseract.js 7.0.0, its locked tesseract.js-core dependency and `@tesseract.js-data/eng` 1.0.0 (English 4.0.0 best-int model). The npm lockfile records exact package integrity. The upstream software and [model repository](https://github.com/naptha/tessdata) use Apache-2.0; the npm data-package wrapper declares MIT (its wrapper code is not shipped). Licence text is retained under `src/dicom_workbench/web/ocr-assets/`.

`npm ci --ignore-scripts` followed by `uv run --locked python scripts/vendor_ocr.py` recreates the selected assets and their SHA-256 manifest. Review any asset or dependency update before regenerating hashes. The static build verifies each hash and copies only the explicit asset list. Source maps, Node modules and backend code are excluded. The portable LSTM core embeds its WebAssembly; it does not require a remote CDN.

The app owns a Worker directly and uses the pinned Tesseract 7 message protocol, so even a stalled startup can be terminated. Dependency upgrades must rerun the lifecycle tests. The app explicitly supplies local worker, core and language paths, disables model caching in IndexedDB, terminates each worker and discards recognised strings. Its CSP permits same-origin scripts/workers and WebAssembly compilation, without ordinary unsafe JavaScript evaluation or inline scripts. Network tests reject external requests.

Images, fonts and the original DICOM fixtures retain the separate licences described in their credit records. An SBOM records dependencies; it does not certify privacy or absence of vulnerabilities.

## Local hospital-record readers (0.4.0)

The locked local Python tool adds pypdf 6.17.0 (BSD-3-Clause) for text extraction and Pillow 12.3.0 (MIT-CMU) for PNG/JPEG decoding and normalisation. They are installed locally and listed in the SBOM; neither reader is shipped in the public Pages frontend. Original PDF and Office containers are never exported. DOCX extraction uses Python's ZIP/XML libraries. Reader limitations and resource bounds are documented in [hospital-records.md](hospital-records.md).

## NIfTI viewer and volume

NiiVue 0.69.0 (BSD-2-Clause), commit `53d450fe2e43c40c0d4ad6a2d8dc08ee37575f8c`, is self-hosted. Its dependency notices are bundled in `src/dicom_workbench/web/nifti-assets/LICENSES.txt`; `vendor.json` pins the shipped module hash. NiBabel 5.3.2 is MIT-licensed and runs in the local Python tool. The brain teaching volume is a prepared CC0 OpenNeuro ds000114 v1.0.2 file; [credits and transformation](nifti.md). The synthetic block fixture is project code (MIT).

The prepared defacing comparison uses the MNI ICBM152 nonlinear asymmetric 2009c average-head template and its supplied brain mask. The original MNI permission notice ships as `nifti-assets/MNI-LICENSE.txt`. The local lower-hull method adapts Quickshear (Schimke & Hale); its BSD-3-Clause notice is retained in [licenses/quickshear.txt](licenses/quickshear.txt). No Quickshear or FSL binary/package is added. The implemented policy, source hashes, atlas publications and preparation steps are recorded in [nifti-defacing.md](nifti-defacing.md).
