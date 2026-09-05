# The teaching image library

Choose **Browse 50 teaching scans** in the local app or the [browser demo](https://zakimaths.github.io/dicom-deid-workbench/#learn=xr-chest-frontal-radiograph). The collection contains 15 MRI, 15 CT and 20 X-ray images. Search for a body part or viewing direction, or filter by scan type. Each image has an anatomy label, a plain-language study note and links to its source and licence.

These are published pictures, not original DICOM files. They help you learn to recognise anatomy and compare viewing directions. They do not exercise the metadata scrubber, and the library does not offer DICOM exports. The original six small files remain under **DICOM test fixtures (6)** for testing file handling and pixel edits.

## How the images were selected

The selection was reviewed on 5 September 2026 against individual Wikimedia Commons descriptions, image licences and the actual pictures. It excludes tiny test fixtures, photographs of screens, an overexposed CT candidate and a candidate with visible identifying text. The selected sources and shipped pictures have at least 512 pixels on each side. Enlarging a picture cannot recover detail absent from its source.

The 50 entries are distinct images, not 50 independent patients or complete examinations. Related projections and separated CT levels are identified in the notes. There are normal-anatomy examples, source-labelled disease examples, implants, annotated composites and two explicitly labelled false-colour MRI composites. Source descriptions determine the case labels; study notes are orientation prompts, not diagnoses. The collection has not undergone expert clinical validation.

Every image was visually checked for useful anatomy, starting contrast and obvious personal text. This does not certify anonymity. Head images retain recognisable anatomy. Existing educational labels, orientation marks and technical overlays are preserved; the library is not a test that the app can remove them.

## Seeing the picture clearly

The viewer starts with the publisher's contrast and fits the whole image without cropping or stretching it. **Actual size** shows the saved pixels; scroll inside the image to explore. Brightness and contrast are optional display adjustments. **Reset view** restores the published appearance and fits the whole picture again.

A published JPEG has already had its scan window applied. These sliders cannot recover Hounsfield units or switch between genuine CT tissue windows. The DICOM workbench still has its separate numerical window/level controls.

The collection keeps the workbench's dark, green and monospace appearance. On larger screens, the catalogue sits beside the large image. On a phone, the image and its study notes appear first, followed by the catalogue. **Find another scan** moves to the search box; selecting a card then brings the chosen image's heading into view and moves keyboard focus there. Filtering leaves the current picture open so you can finish studying it. Previous and next move through the filtered results.

Hover over a button or focus it with the keyboard to read its explanation. Anatomy labels and study notes remain visible without hovering. The collection opens in a modal dialog, keeping keyboard navigation within it. **Return to workbench** or Escape closes the collection and returns focus to **Browse 50 teaching scans**.

**Copy image link** copies a public GitHub Pages link with the selected image's identifier. This works the same way in the local app: it shares the public teaching picture, never a localhost address or an imported DICOM file. If clipboard access fails, the viewer displays the link for you to copy manually.

## Sources and reuse

[The credits list](teaching-image-credits.md) records all 50 sources, creators and licences. Images and thumbnails keep their individual licences, including ShareAlike where applicable. The project's MIT licence covers its code, not these third-party images.

The checked-in [catalogue](../src/dicom_workbench/web/teaching/catalog.json) records source URLs, source byte hashes, source dimensions, shipped dimensions, full-image and thumbnail hashes, changes and review notes. All source downloads were checked against the SHA-1 supplied by Wikimedia; the catalogue also records SHA-256. Before displaying a full picture, the browser checks its SHA-256 and decoded dimensions against the catalogue. A mismatch leaves the picture hidden and shows an error. These checks establish agreement with the committed catalogue; they do not certify medical accuracy or anonymity.

No image is fetched from a third-party host during normal use. The public site fetches its own assets, and source links open only when selected. Teaching pictures stay in a separate JPEG viewer; brightness, contrast and navigation do not pass them through the DICOM scrubber or modify a DICOM job in the workbench.

## Reproducing the collection

Normal builds copy the committed, hash-checked assets. They need no network lookup, image-processing dependency or mutable external image link. The static build is byte-repeatable from the same checkout. Full pictures are JPEGs limited to a 1600-pixel long edge without enlargement; thumbnails are limited to 240 pixels. The collection is approximately 11.1 MiB, with full images loaded on selection and thumbnails loaded lazily.

For optional maintainer regeneration, `scripts/rebuild_teaching.py` downloads only the recorded source URLs into a separate cache, refuses changed source bytes and recreates images into a separate output directory. It was verified with Pillow 12.3.0 with libjpeg-turbo 3.1.4.1 (JPEG 6.2 API); JPEG encoding also depends on the bundled codec, so a different codec can produce different bytes. The script stops on any digest mismatch instead of silently accepting it. Pillow is not a runtime or normal-build dependency.

```sh
uv run --no-project --with pillow==12.3.0 python scripts/rebuild_teaching.py \
  --source-cache output/teaching-sources --output output/teaching-rebuilt
```

The catalogue test checks counts, distinct source/file hashes, licences, dimensions and the complete asset allowlist. Both browser suites open all 50 pictures in Chromium, Firefox and WebKit and check labels, source links, filters, search, navigation, actual size, reset, deep links, corrupt-image rejection, rapid selection and narrow layouts. Local route tests check that traversal and cross-origin requests remain blocked.
