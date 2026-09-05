# Product

<!-- impeccable:product-schema 1 -->

This record describes the implemented project and the user's explicit requests. It is not a clinical product specification.

## Platform

web

## Users

People learning about medical images and de-identification. The interface explains controls in student-facing language. The user also wants a public project that can be tried from GitHub and shared on X and LinkedIn.

## Product Purpose

Let a learner inspect an image, distinguish information stored in a file from text drawn into its pixels, perform the two removal operations, and inspect evidence of the resulting changes. Provide a repeatable local setup on macOS and an installation-free browser demonstration.

## Operating Context

- The public GitHub Pages site is a static frontend using bundled public and synthetic samples. It has no user-file upload or processing backend.
- The local Python application serves a browser interface over loopback and accepts a narrow class of DICOM files. Its command-line tool can also process supported files.
- Both interfaces include a collection of 50 labelled MRI, CT and X-ray teaching pictures. These are published image views, with source and licence records; they are not 50 complete studies or native DICOM acquisitions.
- X, LinkedIn and GitHub profile links appear in the header and footer.

## Capabilities and Constraints

**Teaching PNG workflow.** A learner chooses a teaching picture, opens it in the workbench, and uses **NONYMISE** to add seven explicitly fake PNG text metadata fields and four visible labels. In guided mode the labels occupy added black margins, preserving the original image area during injection. Challenge mode is described in the 0.3.0 additions below. Scrubbing metadata and erasing selected pixels are separate actions. The label-selection shortcut uses the positions recorded during injection; it does not detect text in arbitrary images. Custom numeric rectangles can erase image content.

The exercise can save the fake example, a scrubbed PNG and a verification report. It reopens the encoded output, compares its pixels with the expected image, checks its metadata, and counts remaining injected label pixels. Clean export requires both injected channels to be cleared, the current view, no pending selections, and acknowledgment of the limits. Source attribution remains in the output. Before/current comparison and restart support repeated practice.

**DICOM workflow.** The local implementation accepts supported single-frame, uncompressed 16-bit monochrome classic CT/MR DICOM objects. It applies a documented metadata policy and can replace selected pixels. The public DICOM demonstrations use prepared sample data and export a PNG preview and report. Teaching PNGs do not become DICOM files by entering the workbench.

Neither workflow establishes clinical anonymity or full DICOM conformance. Checks on the PNG exercise cover deliberately injected details only. Existing source labels, recognisable anatomy and other identifying features remain unassessed. A successful exercise is not evidence that an arbitrary medical image is safe to publish.

## Voice and Terminology

Use plain language when describing controls and outcomes. Preserve the user's **NONYMISE** name for adding made-up identifiers. Distinguish “fake metadata removed” from “visible label pixels erased”; report the operation actually completed. Name each teaching image's anatomy and view without inventing a diagnosis.

## Evidence on Hand

- `src/dicom_workbench/web/teaching/catalog.json`: 50 image entries with anatomy, view, learning notes, provenance, licence and file hashes.
- `src/dicom_workbench/web/exercise.js`, `exercise-core.js` and `exercise-png.js`: browser teaching operations and output checks.
- `docs/policy.md`: local DICOM policy and limitations.
- `docs/validation.md` and `tests/`: current test procedures and recorded scope; test counts belong there rather than in this durable product record.
- `docs/teaching-image-credits.md`: public-image attribution.

## Product Principles

- Make each change inspectable and repeatable.
- Keep synthetic identifiers unmistakably fake.
- Preserve the distinction between browser teaching images and supported local DICOM processing.
- Keep public-image provenance and licence information attached to the exercise.
- Describe verification within its actual scope, without implying clinical certification.

## 0.3.0 additions

Seeded challenge mode adds varied synthetic text, including over anatomy, and scores missed injected identifiers and unnecessary pixel changes from the reopened PNG. Its answer reveal marks an attempt as assisted. Local English OCR suggests boxes without access to the answer key; zero detections remain unresolved. The exercise supports zoom, keyboard rectangles and three-step undo. Reports record the generator, seed, content-addressed build and review scope.

The local v2 DICOM policy retains strictly validated acquisition codes and handles required classic CT/MR placeholders. A bounded single-study collection command shares UID mappings by role. Independent validator fixtures and accessibility checks are release gates; neither establishes clinical anonymity. See docs/implementation-status.md for outstanding external dataset, expert and assistive-technology work.
