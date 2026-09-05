"""Public library provenance and serving boundaries, without network access."""

from collections import Counter
import json
from pathlib import Path
from urllib.parse import urlparse

from dicom_workbench.teaching import DIRECTORY, teaching_assets


def test_teaching_inventory_and_provenance():
    items = json.loads((DIRECTORY / "catalog.json").read_text())
    assert Counter(item["modality"] for item in items) == {"MRI": 15, "CT": 15, "X-ray": 20}
    for field in ("id", "sha256", "source_sha256", "source_page_id"):
        assert len({item[field] for item in items}) == 50
    allowed = teaching_assets()  # checks all 100 full/thumbnail file hashes
    assert len(allowed) == 101
    assert {p.name for p in DIRECTORY.iterdir()} == {Path(p).name for p in allowed}
    for item in items:
        assert min(item["width"], item["height"]) >= 512
        assert max(item["width"], item["height"]) <= 1600
        assert min(item["source_width"], item["source_height"]) >= 512
        assert item["author"] and item["look_for"] and item["context"] and item["view"]
        assert item["license"] in {
            "CC BY-SA 4.0",
            "CC BY-SA 3.0",
            "CC BY-SA 2.0",
            "CC BY 2.5",
            "CC0",
            "Public domain",
        }
        assert urlparse(item["source_url"]).netloc == "commons.wikimedia.org"
        assert urlparse(item["license_url"]).netloc == "creativecommons.org"
        assert (DIRECTORY / item["file"]).read_bytes().startswith(b"\xff\xd8")
