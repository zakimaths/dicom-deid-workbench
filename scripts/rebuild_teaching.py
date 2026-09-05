"""Optional maintainer regeneration; normal builds use the committed, hashed JPEGs.

Run in an isolated environment with Pillow 12.3.0. Downloads only the catalogue's
fixed Wikimedia URLs. Never searches for replacements or accepts changed sources.
"""

import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src/dicom_workbench/web/teaching/catalog.json"


def render(raw, thumbnail=False):
    with Image.open(BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        image = Image.frombytes("RGB", image.size, image.tobytes())
        if thumbnail:
            image.thumbnail((240, 240), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=85 if thumbnail else 94, subsampling=0)
        return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.resolve() == CATALOG.parent.resolve():
        parser.error("Use a separate output directory; inspect regenerated images before replacing")
    args.source_cache.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    for item in json.loads(CATALOG.read_text()):
        cache = args.source_cache / (item["source_sha256"] + ".source")
        if not cache.exists():
            url = item["source_file_url"]
            if urlparse(url).scheme != "https" or urlparse(url).netloc != "upload.wikimedia.org":
                raise ValueError("Only the recorded Wikimedia image host is allowed")
            request = Request(
                url,
                headers={
                    "User-Agent": "DICOMWorkbenchTeaching/0.2 github.com/zakimaths/dicom-deid-workbench"
                },
            )
            for attempt in range(5):
                try:
                    with urlopen(request, timeout=60) as response:
                        raw = response.read(25 * 1024 * 1024 + 1)
                    break
                except OSError:
                    if attempt == 4:
                        raise
                    time.sleep(15)
            if sha256(raw).hexdigest() != item["source_sha256"]:
                raise ValueError("The published source changed; review it manually")
            cache.write_bytes(raw)
            time.sleep(3)
        raw = cache.read_bytes()
        if sha256(raw).hexdigest() != item["source_sha256"]:
            raise ValueError("Source cache failed its hash check")
        for field, digest, thumb in (
            ("file", "sha256", False),
            ("thumbnail", "thumbnail_sha256", True),
        ):
            data = render(raw, thumb)
            if sha256(data).hexdigest() != item[digest]:
                raise ValueError(
                    "JPEG output differs; use the recorded Pillow/codec versions or review differences"
                )
            (args.output / item[field]).write_bytes(data)
        print(item["id"])


if __name__ == "__main__":
    main()
