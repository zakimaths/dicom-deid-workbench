# Benchmarks and their limits

## Synthetic text detection

```sh
npm run build:preview
npm run benchmark:ocr
```

The runner writes `output/benchmarks/ocr.json`. It uses a flat 512 × 512 background, deterministic ASCII bitmap text and generator `challenge-1`. Variation includes bold/slanted glyphs, size, brightness/colour, edge/interior positions and 90-degree rotation. These are limited synthetic fonts and layouts, not a representative medical-image corpus or multilingual OCR evaluation.

Development seeds: 11, 22, 33, 44, 55, 66. Compare Tesseract segmentation settings 6 and 11 on these only. This compares two settings of one OCR engine, not independent OCR systems. Test seeds: 7101, 8234, 9345, 10456, 11567, 12678. Test setting 11 was fixed before the first run; results must not be used for further tuning while claiming the same split remains unseen.

First run, 5 September 2026, macOS ARM, Tesseract.js 7.0.0 / English best-int model:

- Development: each setting missed 4 of 16 identifiers across six cases. One innocent marker produced a suggestion with setting 6.
- Frozen test: **8 of 20 identifiers missed**, across 2 of 6 images (2 of 5 with fake identifiers). Two text-bearing images returned no text. One blank control was included.
- This is a complete-erasure score: every injected letter pixel must lie in the proposed erase regions. Partial coverage counts as a missed identifier.
- The JSON records unnecessary masking, innocent-label damage and per-case elapsed time. No worker-memory measurement or confidence interval is claimed for this tiny convenience corpus.

Only pixels reach the detector; it never receives fake strings, seeds, metadata or answer boxes. The scorer uses the separate generator key and reopened saved output in the app. Guided/revealed answers are explicitly assisted exercises. A public JavaScript answer key is inspectable: this is a teaching exercise, not a secure examination.

## Local public-format regression

The manifest runner was executed on 14 prepared/raw variants from the already pinned pydicom test corpus: seven accepted, seven rejected by the support contract, none silently omitted. This includes unsupported transfer syntaxes and malformed/overlay fixtures. It is a format regression set, not 14 independent medical cases or an external PHI benchmark.

## Local external DICOM corpus

TCIA's [MIDI-B collection](https://www.cancerimagingarchive.net/collection/MIDI-B-Test-MIDI-B-Validation/) supplies mixed-modality validation/test data and answer resources. Download using its documented access route and review per-file licences locally. No MIDI-B files or answer keys have been downloaded, redistributed or scored here. Do not call the small built-in corpus a MIDI-B result.

Create a local JSON manifest (ignored `data/` is suitable):

```json
{"schema":1,"split":"validation","cases":[{"path":"case-001.dcm","sha256":"REPLACE_WITH_64_LOWERCASE_HEX_CHARACTERS"}]}
```

```sh
uv run --locked python scripts/benchmark_dicom.py --manifest data/manifest.json --root data --report output/corpus-new.json
```

The runner verifies hashes before processing accepted-size files, never overwrites a report, and reports all accepted, rejected, oversized, unavailable and integrity-failed cases. Paths and source metadata stay out of results. Oversized cases are rejected before full-file hashing. It records processing time and peak traced Python allocations, not total process memory. Keep validation/test partitions separate.

This harness measures format acceptance and metadata processing only. It does not interpret MIDI SQLite answer keys, evaluate arbitrary patient-identifying text or establish clinical de-identification. Integrating the external answer-key evaluator requires a separate reviewed adapter and independent annotations.
