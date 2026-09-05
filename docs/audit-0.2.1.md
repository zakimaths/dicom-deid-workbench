# Adversarial audit and regression evidence — 0.2.1

5 September 2026. Scope: the local, single-frame, 16-bit educational importer, metadata scrubber, rectangle editor and viewer. This records tested behaviour and known limits; it does not establish that every error has been found or that an output is anonymous.

## Findings fixed

| Finding | Change | Repeatable evidence |
| --- | --- | --- |
| A multi-valued identifying-pixel flag could bypass scalar `YES` checks | Require the expected representation, one value, and a supported declaration | Synthetic `NO/YES`, unknown declaration and incorrect control-VR regressions |
| The parser could silently replace an earlier duplicate DICOM attribute | Bounded structural preflight rejects repeated/out-of-order attributes, bad lengths and delimiters | Duplicate identifying-pixel flag, 100 truncations, 200 seeded random headers; valid defined/undefined sequences still pass |
| Unsupported deflated datasets reached the parser before rejection | Read the Part 10 transfer-syntax field before any dataset decoding | Test confirms pydicom is never called for deflated input |
| Numeric imaging fields accepted incorrect value counts; later window widths could be invalid | Check dictionary value multiplicity, all window widths, and paired centers/widths | KVP, geometry, acquisition matrix and window mutation tests |
| Post-write verification could miss a deleted retained field or inconsistent file metadata | Require retained-field presence and exact rebuilt meta values/representations | Every retained synthetic numeric field is individually deleted; file-meta mutations are rejected |
| HTTP or JSON duplicate keys could have competing interpretations | Reject repeated security/framing headers, duplicate selection keys and non-finite JSON constants | Local HTTP/API and strict selection parser tests |
| Small public images inherited an out-of-bounds suggested rectangle | Fit defaults and input maxima to image dimensions; reject blank coordinates | All six public images plus empty/out-of-bounds browser selections |
| Delayed downloads could complete after a different image or selection was chosen | Bind completion to the original job and view revision; invalidate expired views | Browser deliberately holds responses until import or selection/discard has occurred |
| Incomplete pointer gestures were not fully cancelled | Track the active pointer and cancel on Escape/capture loss | Reverse-drag and Escape browser checks; drawing remains available through numeric inputs |
| Clearing could overlap a new import | Keep import controls unavailable until clearing finishes | Browser clear/recovery and busy-state checks |

## Data and test coverage

- Six hash-pinned public CT/MRI fixtures are available through **Browse public scans**, up from two. Four are tiny 16 × 16 test images from pydicom's PCIR collection. Their small size is explicitly labelled. [Provenance, hashes and preparation](public-samples.md).
- Eight additional bundled public fixtures exercise rejection of unsupported transfer syntaxes, truncated input, padding, empty numeric fields and unsupported pixel bit depth. No runtime downloads or relaxation of arbitrary-upload rules are used.
- **117 Python tests** passed on macOS ARM with Python 3.12.11 and pydicom 3.0.2. They include 100 reproducible random rectangle cases checked against independent NumPy masks, all signedness/polarity/rescale combinations, overlapping and edge selections, 32 rectangles on a 1024 × 1024 image, parser corruption, HTTP access boundaries and CLI behaviour. These generated cases are inside test functions, not 100 additional pytest test items.
- **7 JavaScript numerical tests** passed for LINEAR display boundaries, width-one behaviour, inversion, little-endian signed/unsigned decoding and rescale.
- **42 browser workflow groups** passed across Playwright 1.62.1 Chromium, Firefox and WebKit on macOS ARM. Each engine ran the same 14 groups, including every public sample, hover/keyboard explanations, actual exports, repeated same-file import, drag-and-drop, invalid uploads, rectangle editing, stale-response races, expiry, clear and recovery. Layout was checked at 320, 390, 768 and 1440px. No page exceptions or non-loopback requests occurred.
- **21 actual browser-downloaded DICOM files** were independently reopened with pydicom/NumPy. All pixel arrays matched their expected preserved or erased values; reports matched the exact downloaded file hashes. Every pixel in the 18 public-sample canvas previews matched pydicom's independent LINEAR windowing calculation. The CT example lacks window metadata, so its full-range default was supplied explicitly to that comparison.
- The local browser checks use Playwright's bundled engines. WebKit coverage is useful for macOS compatibility; it is not a test or certification of the installed Safari application. CI adds the same workflows on macOS ARM and Linux; see the actual GitHub run for platform results.

## Repeat the pass

```sh
uv sync --locked
uv run --locked pytest -q
uv run --locked ruff check .
uv run --locked python scripts/reproduce.py
npm ci --ignore-scripts
npm test
npx playwright install chromium firefox webkit
npm run test:browser
```

Linux browser installation may need `npx playwright install --with-deps chromium firefox webkit`. The browser suite starts an ephemeral loopback server and stops it afterwards. `BROWSER=webkit npm run test:browser` selects one engine. `PYTHON=/path/to/python` can select an existing environment containing the locked development dependencies. Outputs remain under ignored `output/browser/`; do not add real patient data there or to issues.

The reproduction manifest includes the six upstream public-fixture hashes and preserved pixel hashes, plus synthetic fixture, edited-pixel and semantic-report digests. Random output UIDs intentionally prevent identical whole-file hashes between runs.

## Remaining holes and limits

1. Manual rectangles can miss text. There is no validated OCR, whole-image review gate, automatic text cleaning or evidence of text-detection sensitivity.
2. Recognisable facial anatomy and other identifying structures are unassessed. There is no volume defacing or clinical-utility evaluation.
3. The metadata policy remains a custom subset, not the complete DICOM PS3.15 profile. Full CT/MR IOD validation is absent; required MR fields such as ScanningSequence and SequenceVariant are still removed. Files reopening here does not prove interoperability with every viewer.
4. Six public fixtures provide useful format/control coverage, not vendor, scanner, population or clinical diversity. Tiny fixtures cannot validate preservation of diagnostic detail.
5. The parser preflight deliberately accepts a narrow Explicit VR Little Endian structure. Unknown undefined-length encodings and unsupported formats are rejected. It is not a general DICOM parser, a process sandbox or an exhaustive fuzzing campaign.
6. The post-write checks share pydicom and policy constants with the writer. NumPy and windowing comparisons add algorithmic independence, but an external DICOM validator and privacy benchmark are still needed.
7. The service remains a single-user local development server with one current result. Parallel tabs replace that result; other local processes, browser extensions and OS memory handling are outside its protection boundary.
8. Browser coverage does not include a screen reader, physical touch device, calibrated diagnostic monitor or all possible browser/network failures.

These remaining items are tracked in the [assurance matrix](assurance.md), [96-action roadmap](anonymisation-roadmap.md) and [agent prompts](prompts/README.md).
