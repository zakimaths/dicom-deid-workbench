"""Build an allowlisted static demo; never copy the repository into a Pages artifact."""

import base64
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil

from dicom_workbench.core import transform
from dicom_workbench.fixtures import synthetic_dicom
from dicom_workbench.samples import SAMPLES, sample_dicom
from dicom_workbench.teaching import teaching_assets

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "src/dicom_workbench/web"
OUT = ROOT / "output/pages"


def build():
    # This path is fixed and generated. Do not accept user-provided cleanup paths.
    if OUT.is_symlink():
        raise ValueError("The preview output must not be a symlink")
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    html = (WEB / "index.html").read_text()
    html = (
        html.replace('href="/"', 'href="./"')
        .replace('href="/', 'href="./')
        .replace('src="/', 'src="./')
    )
    html = html.replace(
        '<script type="module" src="./app.js"></script>',
        '<script type="module" src="./preview.js"></script>',
    )
    html = html.replace('href="./nifti"', 'href="./nifti.html"')
    html = html.replace(
        'href="./records"',
        'href="https://github.com/zakimaths/dicom-deid-workbench#hospital-records-local-only"',
    ).replace("Review reports, records &amp; image files ↗", "Hospital records · local setup ↗")
    html = html.replace(
        "<title>DICOM Workbench</title>", "<title>DICOM Workbench · browser demo</title>"
    )
    html = html.replace(
        '<meta charset="UTF-8" />',
        """<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <meta name="referrer" content="no-referrer" />""",
    )
    html = html.replace(
        "A local DICOM metadata scrubber and 2D viewer. Explore with a synthetic image.",
        "Try DICOM Workbench with sample images in your browser. No file uploads; PNG previews only.",
    )
    html = re.sub(
        r'<label class="file-label" for="file".*?</label>',
        '<a class="file-label" href="https://github.com/zakimaths/dicom-deid-workbench#run-the-local-tool" target="_blank" rel="noopener noreferrer">Run the local tool ↗</a>',
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace(
        "Inspect an image. Scrub its metadata. Review what changed. A local\n            tool for learning how DICOM works.",
        "Try the viewer with sample images. Adjust contrast, inspect example metadata changes, and practise erasing a rectangle.",
    )
    html = re.sub(
        r"<p>Single-frame CT or MR.*?</p>",
        "<p>Browser demo · sample images only · no file uploads</p>",
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r"or drop a file here.*?data\.",
        "The demo uses prepared examples. File imports and DICOM exports are available in the local tool.",
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r"load from your computer\s+without an internet\s+request\.",
        "are fetched from this site when you select one; edits stay in this tab.",
        html,
    )
    html = re.sub(
        r"<strong>Metadata scrubbing is only one step\.</strong>.*?anonymiser\.",
        "<strong>This is a sample-only browser demo.</strong> The teaching PNG exercise adds and removes fake metadata live. DICOM sample reports were prepared with the local tool before publication. You can edit samples and save a PNG. This demo does not process your DICOM files or establish anonymity.",
        html,
        count=1,
        flags=re.S,
    )
    html = html.replace(
        "Load the example or choose a supported DICOM.",
        "Choose a synthetic example or browse the public samples.",
    )
    html = html.replace(
        "Preview of the metadata-scrubbed DICOM pixel data", "Sample image preview; PNG export only"
    )
    html = html.replace(
        "This changes the saved image. Mark a rectangle or enter its",
        "This edits the sample in this tab and the PNG you save. Mark a rectangle or enter its",
    )
    html = re.sub(
        r"Contrast controls affect the preview\. Exported pixels stay\s+unchanged\.",
        "PNG downloads include the contrast settings and any applied edits you see here.",
        html,
    )
    html = (
        html.replace("METADATA REPORT", "EXAMPLE METADATA CHANGES")
        .replace("fields scrubbed", "fields changed")
        .replace("What changed", "Prepared with the local tool")
    )
    html = html.replace(
        "Pixel preservation and file reopen checks run after processing.",
        "Choose a sample to see its prepared metadata report and try the viewer.",
    )
    html = re.sub(
        r"I understand that unselected pixels and recognisable anatomy\s+remain unassessed\.",
        "I understand this saves a PNG preview, not an anonymised DICOM file.",
        html,
    )
    html = html.replace("Download scrubbed DICOM", "Save PNG preview").replace(
        "Download action report", "Save exercise report"
    )
    html = html.replace("Local processing</span", "Browser demo</span")
    html = html.replace(
        'LOCAL PROCESSING <span aria-hidden="true">/</span> NO CLOUD\n          UPLOADS',
        'BROWSER DEMO <span aria-hidden="true">/</span> NO FILE UPLOADS',
    )
    html = html.replace(
        "One image at a time. Temporary results expire after 10 minutes or when\n          cleared.",
        "DICOM exercise edits stay in this tab and clear after 10 minutes. GitHub hosts the site; external profile links open only when you select them.",
    )
    assert 'type="file"' not in html and "/app.js" not in html
    (OUT / "index.html").write_text(html)
    (OUT / "style.css").write_text(
        (WEB / "style.css").read_text().replace('url("/fonts/', 'url("./fonts/')
    )
    for name in (
        "pixels.js",
        "favicon.svg",
        "exercise.js",
        "exercise-core.js",
        "exercise-png.js",
        "challenge.js",
        "challenge-score.js",
        "ocr.js",
        "build-info.js",
    ):
        shutil.copyfile(WEB / name, OUT / name)
    ocr = json.loads((WEB / "ocr-assets/manifest.json").read_text())
    (OUT / "ocr-assets").mkdir()
    for name, digest in ocr.items():
        raw = (WEB / "ocr-assets" / name).read_bytes()
        assert sha256(raw).hexdigest() == digest, "OCR asset hash mismatch"
        (OUT / "ocr-assets" / name).write_bytes(raw)
    shutil.copyfile(WEB / "ocr-assets/manifest.json", OUT / "ocr-assets/manifest.json")
    code_hash = sha256(
        b"".join(
            (WEB / name).read_bytes()
            for name in (
                "exercise.js",
                "exercise-core.js",
                "challenge.js",
                "challenge-score.js",
                "ocr.js",
            )
        )
    ).hexdigest()
    (OUT / "build-info.js").write_text(
        "export const BUILD = Object.freeze("
        + json.dumps(
            {"version": "0.4.0", "revision": "sha256:" + code_hash, "report_schema": 3},
            sort_keys=True,
        )
        + ");\n"
    )
    library = teaching_assets()
    (OUT / "teaching").mkdir()
    for name in ("teaching.js", "teaching.css", *library):
        shutil.copyfile(WEB / name, OUT / name)
    shutil.copyfile(ROOT / "preview/preview.js", OUT / "preview.js")
    (OUT / "fonts").mkdir()
    for name in (
        "jetbrains-mono-regular.ttf",
        "jetbrains-mono-semibold.ttf",
        "press-start-2p.ttf",
        "JetBrainsMono-OFL.txt",
        "PressStart2P-OFL.txt",
    ):
        shutil.copyfile(WEB / "fonts" / name, OUT / "fonts" / name)
    (OUT / "samples").mkdir()
    cases = {"demo": synthetic_dicom(), "text": synthetic_dicom(with_text=True)}
    cases.update({key: sample_dicom(key) for key in SAMPLES})
    for key, raw in cases.items():
        result = transform(raw)
        # Publish only known fixture pixels and value-free metadata actions, never
        # source DICOM containers, raw metadata, generated UIDs or backend modules.
        sample = {
            "id": key,
            "title": SAMPLES[key]["title"]
            if key in SAMPLES
            else "Fake-text exercise"
            if key == "text"
            else "Geometric CT phantom",
            "source": SAMPLES[key]["source"]
            if key in SAMPLES
            else "Generated shapes and made-up identifiers",
            "preparation": SAMPLES[key]["preparation"]
            if key in SAMPLES
            else "Synthetic example. No patient data.",
            "image": result.image,
            "pixels": base64.b64encode(result.pixels).decode("ascii"),
            "pixel_sha256": sha256(result.pixels).hexdigest(),
            "metadata": {
                "prepared_at_build_time": True,
                "policy": result.report["policy"],
                "counts": result.report["counts"],
                "actions": result.report["actions"],
            },
        }
        (OUT / "samples" / f"{key}.json").write_text(
            json.dumps(sample, sort_keys=True, separators=(",", ":")) + "\n"
        )
    volume_html = (WEB / "nifti.html").read_text()
    volume_html = re.sub(r"<!-- local:start -->.*?<!-- local:end -->", "", volume_html, flags=re.S)
    volume_html = volume_html.replace("./nifti-local.js", "./nifti.js").replace(
        "Local volume review", "Public teaching volumes"
    )
    volume_html = volume_html.replace(
        "Choose a teaching volume or a supported local file.",
        "Choose a teaching volume. This public demo accepts no file uploads.",
    )
    volume_html = volume_html.replace(
        '<meta charset="UTF-8" />',
        "<meta charset=\"UTF-8\" /><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'\" /><meta name=\"referrer\" content=\"no-referrer\" />",
    )
    assert 'type="file"' not in volume_html
    (OUT / "nifti.html").write_text(volume_html)
    for name in ("nifti.js", "nifti.css"):
        shutil.copyfile(WEB / name, OUT / name)
    (OUT / "nifti-assets").mkdir()
    nifti_assets = [
        "niivue-0.69.0.js",
        "brain-t1.nii.gz",
        "phantom.nii.gz",
        "samples.json",
        "LICENSES.txt",
        "vendor.json",
    ]
    for name in nifti_assets:
        shutil.copyfile(WEB / "nifti-assets" / name, OUT / "nifti-assets" / name)
    (OUT / ".nojekyll").touch()
    allowed = {"index.html", "style.css", "pixels.js", "preview.js", "favicon.svg", ".nojekyll"}
    allowed |= {f"samples/{key}.json" for key in cases}
    allowed |= {
        "teaching.js",
        "teaching.css",
        "exercise.js",
        "exercise-core.js",
        "exercise-png.js",
        "challenge.js",
        "challenge-score.js",
        "ocr.js",
        "build-info.js",
        *library,
    }
    allowed |= {
        "nifti.html",
        "nifti.js",
        "nifti.css",
        *("nifti-assets/" + name for name in nifti_assets),
    }
    allowed |= {f"fonts/{p.name}" for p in (OUT / "fonts").iterdir()}
    allowed |= {"ocr-assets/" + n for n in [*ocr, "manifest.json"]}
    files = {str(p.relative_to(OUT)) for p in OUT.rglob("*") if p.is_file()}
    assert files == allowed and not any(p.is_symlink() for p in OUT.rglob("*"))
    print(f"Built {len(files)} allowlisted frontend assets in output/pages")


if __name__ == "__main__":
    build()
