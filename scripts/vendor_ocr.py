"""Copy only pinned browser OCR assets; npm ci --ignore-scripts must run first."""

from pathlib import Path
from hashlib import sha256
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/dicom_workbench/web/ocr-assets"
FILES = {
    "tesseract.min.js": "tesseract.js/dist/tesseract.min.js",
    "worker.min.js": "tesseract.js/dist/worker.min.js",
    "tesseract-core-lstm.wasm.js": "tesseract.js-core/tesseract-core-lstm.wasm.js",
    "eng.traineddata.gz": "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    "Tesseract-LICENSE.txt": "tesseract.js/LICENSE.md",
    "Core-LICENSE.txt": "tesseract.js-core/LICENSE",
}
if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for dest, source in FILES.items():
        shutil.copyfile(ROOT / "node_modules" / source, OUT / dest)
    manifest = {name: sha256((OUT / name).read_bytes()).hexdigest() for name in FILES}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
