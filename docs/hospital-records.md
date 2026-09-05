# Hospital records: scope, checks and measured limits

Version 0.4.0 adds real file imports to a local review workflow. The importer does not require a synthetic-data marker. It can process authorised hospital-origin files within the formats below, but that is different from demonstrating reliable anonymisation across hospitals.

## What you can use now

Start the local tool and open `/records`. Text suggestions use explicit patterns for labelled identifiers and common contact/date formats. Add known identifiers or select missed text yourself. Suggestions can be removed individually. Re-running suggestions preserves manual selections. Applying the selection produces a new plain-text copy and verifies that selected non-whitespace characters were replaced and everything else stayed unchanged relative to the extracted review text. The browser first normalises Windows/old-Mac line endings to LF so text selection positions agree; the processing report records this normalisation.

| Input | Local result | Important restriction |
| --- | --- | --- |
| UTF-8 TXT | Reviewed TXT | Unlabelled names, context-dependent identifiers and many languages need manual review |
| CSV with a header | Labelled rows in TXT | Columns become text; formulas remain inert text |
| JSON | All parsed keys and values in a TXT review copy | Duplicate keys/non-finite values rejected; no validated FHIR output |
| PDF, 1–30 pages | Extracted text in TXT | Encrypted or textless pages rejected; images, attachments, annotations and layout omitted |
| DOCX | Extracted paragraphs in TXT | Available headers/footers/comments/revisions included; embedded files, images and layout omitted |
| Single PNG/JPEG | New PNG | Metadata removed, orientation normalised and transparency flattened onto white; original pixels are not a diagnostic-preservation baseline |
| Supported classic CT/MR DICOM | Existing DICOM workbench or collection command | Explicit VR Little Endian, one frame, monochrome, 16-bit; the support contract remains narrow |

Each input is limited to 8 MiB; text to 200,000 Unicode characters; pictures to 2,903,616 pixels. Animated and high-bit-depth pictures are rejected. Original PDF/Office containers are never exported. Compare extracted text with the original: omission of a picture or attachment can remove important clinical information. A page containing text and an image still produces **text only**.

The picture workflow supports numbered rectangle outlines, fit/full-size inspection, offline English OCR suggestions and manual rectangles. Erasure replaces actual RGBA pixels with opaque black. The saved PNG is reopened and checked against the normalised imported picture: selected pixels are black, and all other pixels remain exact. OCR does not assess faces, handwritten notes or all printed text. It can return no boxes even when identifying text exists.

A DICOM collection now accepts 1–512 supported files, with a 128 MiB total bound. Study/series/frame identifiers remain consistent. Duplicate SOP identifiers, mixed studies, conflicting series frames and referenced-object sequences at any nesting level are rejected. Sequences still are not retained. Native DX/CR, compressed/enhanced/multiframe DICOM, longitudinal date shifting and volume defacing remain unsupported.

## What the statistics actually measure

A processing report records changes and postconditions, not detection accuracy. It contains counts, fixed categories, output hash and review acknowledgements. It does not contain source text, source filenames, identifier values or persistent patient mappings. Reports and exports are saved only on request. The app has no hospital-record database or telemetry.

The separate evaluator accepts an independently annotated local text corpus. It records:

- Full-identifier recall: a partly removed identifier is a miss.
- Misses in every record, record failure rate and grouped-subject failure rate.
- All 18 identifier categories, with absent categories reported as untested (`null`).
- Suggestion overlap precision, non-whitespace PHI character recall/precision/F1, and unnecessary changes to non-PHI characters.
- Negative-record false positives, processing errors, complete denominators, latency and peak traced Python allocation for each case. Traced allocation is not total process memory.
- Descriptive 95% Wilson intervals, declared source provenance, software version, detector/scorer fingerprints and corpus fingerprint.

The detector receives only text. It does not receive the answer spans, subject keys or optional known-identifier list. Failed processing stays in the denominator and counts as a failed record. Duplicate text and a subject crossing validation/test splits are rejected. Group names and source text are never returned in the report.

The intervals use the [Wilson method described by NIST](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm). Identifiers and characters within a record are correlated. A subject-level interval has a sampling interpretation only when subjects are independently sampled. Repeated templates are **not independent patients**. No statistical-significance test or hospital-readiness threshold has been met here.

A compact [machine-readable result](evaluation-0.4.0.json) is committed; CI retains the full per-case report.

## Recorded run: 5 September 2026

The new deterministic regression corpus contains 840 synthetic records: 240 validation and 600 test records. There are 18 labelled identifier categories, four presentations, explicit negative controls and ordinary-sentence name challenges. Each partition has 76 template groups. Partitions share template families; this is a transparent engineering regression set, not an unseen clinical benchmark.

| Measure | Validation | Test |
| --- | --- | --- |
| All records | 240 | 600 |
| Labelled identifier occurrences removed | 180 / 180 | 540 / 540 |
| Unlabelled narrative names removed | 0 / 30 | 0 / 30 |
| Overall complete-identifier recall | 180 / 210 (85.7%) | 540 / 570 (94.7%) |
| Descriptive identifier-recall interval | 80.3–89.8% | 92.6–96.3% |
| Records with a miss | 30 / 240 | 30 / 600 |
| Negative records with a false positive | 0 / 30 | 0 / 30 |
| Non-PHI characters changed | 0 / 18,970 | 0 / 45,340 |
| Processing errors | 0 | 0 |

The test score is higher because its case mix contains more labelled examples, **not because the detector improves on new patients**. The name category alone is 30/60 complete in the test partition. The other 17 categories each have 30/30 labelled textual examples. “Photo ID” and “Biometric ID” are textual references; these do not test actual faces, fingerprints or voiceprints. Their image-level accuracy remains untested.

Known-value matching and manual corrections were tested separately, including apostrophes, full-width characters, case folding, zero-width characters and browser/Python character-position differences. Those checks do not get added to the automatic recall numerator.

Tests also plant 23 standard metadata identifiers in each of two real-origin public CT/MR DICOM containers, plus nested/private fields and UID mappings. All 46 field-removal cases pass and retain pixel bytes. These are two public software fixtures with injected identifiers, not 46 independent clinical studies. A 20-image derived study verifies consistent mapping beyond the former 16-file limit. The pre-existing 16 independent `dciodvfy` export checks pass.

No independently annotated hospital-note corpus or MIDI-B answer-key dataset has been scored in this release. The [n2c2 research datasets](https://n2c2.dbmi.hms.harvard.edu/data-sets) and [TCIA MIDI-B collection](https://www.cancerimagingarchive.net/collection/MIDI-B-Test-MIDI-B-Validation/) are routes to external evaluation with their stated access and reuse conditions. The existing MIDI manifest runner measures file acceptance; it does not score the benchmark's SQLite answer keys.

## Reproduce the engineering run

```sh
uv sync --locked
npm ci --ignore-scripts
npm run benchmark:records
```

The input is written to `output/records-corpus.json`; the report to `output/records-evaluation.json`. Reports use exclusive creation: move the previous report aside or choose a new report path for a repeat. Timings and allocation peaks vary; the identifier counts, corpus content and fingerprints are reproducible with the same source and environment. CI generates a fresh report and retains it as an artifact.

## Evaluate your own authorised corpus

Keep source records and answer keys in ignored `data/`, outside public commits. Have reviewers annotate all identifying spans in the **extracted text**, using zero-based Unicode code-point offsets with an exclusive end. The answer key must not be generated from the detector being measured. Agree an annotation policy, reconcile disagreements, retain true negative records and group records from the same person together.

```json
{
  "schema": 1,
  "cases": [
    {
      "subject": "local-group-001",
      "split": "test",
      "origin": "synthetic",
      "text": "Patient: Alex Example",
      "identifiers": [{"start": 9, "end": 21, "category": "name"}]
    }
  ]
}
```

Allowed origins are `synthetic`, `public_clinical`, and `authorised_clinical`; these are declarations, not an access-control mechanism. Use `validation` to develop rules and a separately annotated `test` partition for final evaluation. Once a test set has guided changes, freeze a new external test set for a new generalisation claim.

Categories: `name`, `geography`, `date_age`, `phone`, `fax`, `email`, `ssn`, `medical_record`, `health_plan`, `account`, `licence`, `vehicle`, `device`, `url`, `ip`, `biometric`, `face`, `other_identifier`.

```sh
uv run --locked python scripts/evaluate_records.py \
  --corpus data/annotated-text.json \
  --report output/clinical-evaluation-001.json
```

The corpus is limited to 32 MiB and 10,000 cases. This evaluates text detection and replacement; it does not evaluate extraction completeness, image OCR or anatomical identification. Inspect exported aggregate reports before sharing results from small clinical cohorts.

## Local processing boundary

Only the loopback server exposes these imports. It requires its session token, checks Host/Origin and request shape, disables caching and logs no request contents. Records APIs are stateless. The browser clears its state after ten minutes of inactivity or on navigation; this is not guaranteed forensic erasure from OS/browser memory. Downloads remain wherever you save them.

PDF/Office/image parsers run in a child process with a 15-second wall timeout and 10-second CPU limit. Linux adds an address-space limit; macOS samples resident memory and terminates above 512 MiB. The macOS watchdog is sampled, not a hard sandbox or instantaneous memory ceiling. It fails closed if monitoring or parsing fails. No patient content is sent to an external OCR, LLM or API. The public Pages build remains a 136-file frontend allowlist and excludes these local routes, readers and uploaded files.

HHS explicitly includes free text in its [de-identification guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html). Removing familiar fields alone does not establish anonymity, and the guidance distinguishes Safe Harbor from Expert Determination. This tool makes neither determination. Hospital deployment still needs an approved environment, representative external evaluation and a defined human release process.
