# Public teaching scans

Use **Browse public scans** to open a CT or MRI slice. Both load locally from the pinned pydicom 3.0.2 dependency. No scan is downloaded at runtime and no upload is sent to an external service. Each load uses the same metadata-scrubbing and pixel-verification pipeline as an upload. New output identifiers still change on each load.

These are public sample images, not a new clinical dataset or a claim that arbitrary scans are open-source. They are low-resolution, single-slice teaching examples. Public availability does not establish clinical suitability or complete de-identification.

## Sources and reuse

[pydicom's example tutorial](https://pydicom.github.io/pydicom/stable/tutorials/dataset_basics.html) uses CT_small.dcm. Its [versioned test-data provenance](https://github.com/pydicom/pydicom/blob/v3.0.2/src/pydicom/data/test_files/README.txt) identifies CT_small.dcm and MR_small.dcm as downsized copies of NEMA WG04 CT1_UNC and MR1_UNC. The maintainers describe their use as bundled test fixtures. pydicom distributes them with its package; this project uses those existing local files rather than copying scans into this repository. See the upstream [licence and notices](https://github.com/pydicom/pydicom/blob/v3.0.2/LICENSE). Do not assume every other pydicom dataset has identical provenance or terms.

| Sample | Matrix | SHA-256 of upstream bytes |
| --- | --- | --- |
| CT_small.dcm | 128 × 128 | `3dd31e5cc835b3f2cdd46c9da1982f59251e78518fefa8163d914631c66437d6` |
| MR_small.dcm | 64 × 64 | `3f27d1c22f1a66e80d7bb7c911e8610fd0bb70325a76746a7adb1c0ddefcf2bb` |

## Preparation for this viewer

The original fixtures do not directly satisfy the deliberately narrow importer. Only these hash-verified examples receive preparation, in memory:

- CT: remove PixelPaddingValue (-2000) after checking that **no pixel has that value**. No actual padding pixel is discarded or modified.
- MRI: remove the empty EchoTrainLength field, which the importer otherwise rejects as nonnumeric.

Every other dataset element and every pixel byte are unchanged before the normal scrub runs. The UI identifies the selected public sample and displays its preparation. The action report describes scrubbing of the prepared input; the preparation above happens first and is not counted as a scrub action. User uploads retain the original strict validation rules.

## Repeat the test

Run `uv run --locked pytest tests/test_samples.py tests/test_server.py`. Tests check source hashes, repeatable preparation, unchanged remaining elements, preserved output pixels, cleared identity placeholders, route access checks and downloads. Missing or altered fixtures produce a readable error rather than fetching a replacement.

In the browser, load CT, change contrast, download a report, then load MRI and confirm that acknowledgement resets. Test hover, keyboard focus and Escape on each button. The expandable **Button guide** provides the same explanations on touch devices.
