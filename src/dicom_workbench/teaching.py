"""Explicit public teaching-asset list, shared by the local server and Pages build."""

from hashlib import sha256
import json
from pathlib import Path
import re

DIRECTORY = Path(__file__).parent / "web/teaching"


def teaching_assets():
    items = json.loads((DIRECTORY / "catalog.json").read_text())
    if len(items) != 50 or len({item["id"] for item in items}) != 50:
        raise ValueError("Expected 50 distinct teaching image entries")
    assets = {"teaching/catalog.json": "application/json"}
    for item in items:
        if not re.fullmatch(r"[a-z0-9-]+", item["id"]):
            raise ValueError("Invalid teaching image ID")
        for field, suffix, digest in (
            ("file", ".jpg", "sha256"),
            ("thumbnail", "-thumb.jpg", "thumbnail_sha256"),
        ):
            filename = item["id"] + suffix
            path = DIRECTORY / filename
            if (
                item[field] != filename
                or path.is_symlink()
                or sha256(path.read_bytes()).hexdigest() != item[digest]
            ):
                raise ValueError("Teaching image failed its integrity check")
            assets[f"teaching/{filename}"] = "image/jpeg"
    return assets
