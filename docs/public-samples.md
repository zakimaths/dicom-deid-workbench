# Public DICOM test fixtures

For larger anatomy images, use the separate [50-image teaching library](teaching-library.md).

Choose **DICOM test fixtures (6)** to open a CT or MRI example. In the local tool, all six come from the pinned pydicom 3.0.2 package and pass through the same processing checks as an upload. No scan needs to be fetched during local use. The browser demo fetches prepared pixel/report assets from its own site and does not run the DICOM scrubber or accept uploads.

These are existing public test images. Their availability does not mean other scans are open-source or safe to share. Two are low-resolution slices; four are tiny 16 × 16 test fixtures, useful for exercising image-boundary controls rather than anatomical detail. Public availability does not establish clinical suitability or complete de-identification.

## Sources and reuse

[pydicom's example tutorial](https://pydicom.github.io/pydicom/stable/tutorials/dataset_basics.html) uses CT_small.dcm. Its [versioned test-data provenance](https://github.com/pydicom/pydicom/blob/v3.0.2/src/pydicom/data/test_files/README.txt) identifies CT_small.dcm and MR_small.dcm as downsized copies of NEMA WG04 CT1_UNC and MR1_UNC. The same provenance file identifies the dicomdirtests collection as PCIR images reduced to 16 × 16 for unit testing. The maintainers describe their use as bundled test fixtures. pydicom distributes them with its package; this project uses those existing local files rather than copying scans into this repository. See the upstream [licence and notices](https://github.com/pydicom/pydicom/blob/v3.0.2/LICENSE). Do not assume every other pydicom dataset has identical provenance or terms.

| Sample | Matrix | SHA-256 of upstream bytes |
| --- | --- | --- |
| CT_small.dcm | 128 × 128 | `3dd31e5cc835b3f2cdd46c9da1982f59251e78518fefa8163d914631c66437d6` |
| MR_small.dcm | 64 × 64 | `3f27d1c22f1a66e80d7bb7c911e8610fd0bb70325a76746a7adb1c0ddefcf2bb` |

The four additional entries are distinct fixtures, not alternate encodings of MR_small. Their pinned relative paths identify the exact upstream test files:

| UI label | pydicom test-file path | SHA-256 |
| --- | --- | --- |
| CT test slice A | dicomdirtests/77654033/CT2/17106 | `678df720411e86df67031c28e16192cd31e2062a3f090d657b9f16ce86db3f1d` |
| CT test slice B | dicomdirtests/98892001/CT2N/6293 | `de2970da0589ca948fba863bf0e93f4c18a1695bd3ec2fe8fa73905b53ac5e67` |
| MRI test slice A | dicomdirtests/98892003/MR1/4919 | `1a0fc2ec617623aeeccf4492bc605ace4efb33cebce7fe4dd54bce472b1c8635` |
| MRI test slice B | dicomdirtests/98892003/MR1/5641 | `fb809e867ae98a1c995d41f0d458fb7aa2cf117b8b7331559bd0134653c984e8` |

## Preparation for this viewer

Some original fixtures contain fields the narrow importer does not support. Only these hash-verified examples receive preparation, in memory:

- CT: remove PixelPaddingValue (-2000) after checking that **no pixel has that value**. No actual padding pixel is discarded or modified.
- MRI teaching slice: remove the empty EchoTrainLength field.
- CT test slice A: remove unused PixelPaddingValue, after the same no-matching-pixels check.
- CT test slice B: remove an empty ReconstructionDiameter field.
- MRI test slices A and B: no metadata preparation is required.

Preparation leaves every other field and pixel byte unchanged before the local scrub runs. The UI identifies the selected public sample and displays its preparation. The action report describes scrubbing of the prepared input; the preparation above happens first and is not counted as a scrub action. User uploads retain the original strict validation rules.

## Repeat the test

Run `uv run --locked pytest tests/test_samples.py tests/test_server.py`. Tests check source hashes, repeatable preparation, unchanged remaining elements, preserved output pixels, cleared identity placeholders, route access checks and downloads. Missing or altered fixtures produce a readable error rather than fetching a replacement.

In the browser, load CT, change contrast, download a report, then load MRI and confirm that acknowledgement resets. Test hover, keyboard focus and Escape on each button. The expandable **Button guide** provides the same explanations on touch devices.
