# DICOM Workbench

A small **local DICOM metadata scrubber and 2D viewer**. Load a synthetic example, adjust window/level, inspect the metadata actions and download the transformed file.

Built for a straightforward macOS setup. One runtime dependency, no frontend build, no cloud service.

> **Educational prototype.** This is a limited metadata policy, not a complete anonymiser, a HIPAA compliance tool or a diagnostic viewer. Pixels and recognisable anatomy are not assessed. Use synthetic or already-public data. The export is not automatically safe to publish.

![DICOM Workbench displaying a generated synthetic phantom](docs/screenshot.png)

## Run locally

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) if needed (`brew install uv` on macOS), then:

```sh
git clone https://github.com/zakimaths/dicom-deid-workbench.git
cd dicom-deid-workbench
uv sync --locked
uv run --locked dicom-workbench serve
```

Open **[http://127.0.0.1:8765](http://127.0.0.1:8765)** and select **Try synthetic example**. No DICOM download is needed. Stop with `Ctrl+C`.

uv installs the Python version specified in `.python-version`. The service runs natively; Docker and Node.js are not needed to use the app. Installation needs network access; the app itself uses only local assets and loopback requests. If port 8765 is occupied, use `serve --port 8766`.

## What v0.1 does

- Generates a deterministic, geometric CT phantom with fake identifiers, including nested and private fields. No clinical image is bundled.
- Imports one supported Part 10 file, at most 8 MiB / 1024 × 1024 pixels.
- Builds a new dataset using an explicit numeric-imaging allowlist, blanks selected identity fields, replaces instance/study/series IDs, removes all sequences and private fields, and rebuilds file metadata and preamble.
- Displays the output pixel bytes with signed/unsigned decoding, rescale, DICOM LINEAR windowing, MONOCHROME1 inversion and pixel-spacing aspect ratio.
- Checks output reopen and byte-for-byte pixel preservation. Downloads the transformed DICOM and a report without original metadata values.
- Keeps one temporary result in server memory, replacing it on import and expiring it after ten minutes. **Clear** also releases the browser preview and server result.

## Supported input

| Feature | v0.1 scope |
| --- | --- |
| SOP classes | Classic CT Image Storage / MR Image Storage |
| Transfer syntax | Explicit VR Little Endian, uncompressed |
| Frames | One |
| Pixels | One channel; 16 allocated and stored bits; HighBit 15; signed or unsigned |
| Photometric interpretation | MONOCHROME1 or MONOCHROME2 |
| Contrast | Linear slope/intercept and standard LINEAR windowing |
| Excluded | Compressed data, enhanced multiframe, colour, LUT sequences, padding, non-identity presentation LUTs, PixelAspectRatio, known identifying-pixel flags |

Images declaring `BurnedInAnnotation=YES` or `RecognizableVisualFeatures=YES` are rejected. Missing flags or `NO` do **not** establish safe pixels. All accepted images retain the "pixels not assessed" notice.

**Trade-off:** the conservative allowlist discards other fields and all relationships in sequences, including potentially useful or required acquisition information. Output is reopened with pydicom, but complete CT/MR IOD validity and PS3.15 conformance are **not** established. It is unsuitable for clinical exchange. IDs are fresh per file, so processing a series file-by-file does not preserve study continuity. See [the policy](docs/policy.md).

## Repeatable checks

```sh
uv run --locked pytest
uv run --locked ruff check .
uv run --locked python scripts/reproduce.py
```

The reproduction command generates the phantom, checks transformation invariants, and writes `output/reproduction.json` with environment and deterministic fixture/pixel/report hashes. Output DICOM identifiers are random by design; we test equivalent behaviour, not identical output DICOM bytes.

For the frontend's small numerical test suite, install Node.js 22 or newer and run:

```sh
node --test tests/pixels.test.mjs
```

CI runs Python checks on macOS arm64, macOS Intel and Linux, plus the JavaScript pixel tests. See [validation notes](docs/validation.md) for what was actually checked; a CI pass does not establish Safari rendering or privacy effectiveness.

## Command-line usage

The CLI and browser call the same transformation engine:

```sh
uv run --locked dicom-workbench fixture /tmp/synthetic.dcm
uv run --locked dicom-workbench scrub /tmp/synthetic.dcm /tmp/scrubbed.dcm --report /tmp/scrub-report.json
```

Existing output files are never overwritten. Choose new paths when repeating these commands. The CLI does not open a browser or require the service.

## Why this stack?

Python + [pydicom](https://pydicom.github.io/) handles file parsing and writing. A tiny standard-library HTTP service hosts plain JavaScript and Canvas. The browser receives binary pixel bytes, not a JSON array or lossy PNG; contrast changes do not alter export pixels.

This intentionally simplifies the original React/Cornerstone proposal. For one uncompressed frame, a small, tested display pipeline avoids a build system, WebGL setup and codec workers. A future broader viewer should adopt Cornerstone3D rather than accumulate custom image-format handling.

```text
local file / synthetic generator
             ↓
      Python metadata policy ← CLI
             ↓
   new DICOM + output checks
             ↓
 local browser preview + download
```

## Privacy and limitations

The service binds only to `127.0.0.1`, validates Host/Origin, uses a per-launch request token and serves no third-party assets. It does not write uploads to disk, send telemetry or log file contents. It is a **single-user development tool**, not a hardened server. Do not expose it through a reverse proxy, tunnel or shared network. Other local processes and browser extensions are outside its protection boundary. Memory clearing is not a secure-erasure guarantee.

Names in pixels, recognisable anatomy, numeric fingerprints and remaining metadata may identify someone. A download acknowledgement communicates scope; it is not a privacy assessment. Do not upload patient files to GitHub issues, screenshots or CI. Read [SECURITY.md](SECURITY.md).

The design is informed by [DICOM PS3.15](https://dicom.nema.org/medical/dicom/current/output/chtml/part15/chapter_E.html) and [DICOM LINEAR windowing](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.11.2.html). Those references are not conformance claims.

## Small next steps

1. Independently validate and preserve required fields for a precisely defined CT/MR subset.
2. Add a coherent multi-file UID mapping and series-level tests.
3. Adopt Cornerstone3D if adding compressed formats or stack navigation.

Pixel redaction, facial de-identification, DICOMweb and clinical workflows are outside this release. Suggestions and synthetic reproductions are welcome.

MIT licensed. Generated demo geometry is original; no external patient dataset is redistributed. [Shareable post drafts](docs/share.md).
