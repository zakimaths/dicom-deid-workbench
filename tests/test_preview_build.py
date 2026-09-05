"""The public artifact must contain only the explicit sample-demo assets."""

from hashlib import sha256
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("preview_build", ROOT / "scripts/build_preview.py")
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


def test_preview_is_repeatable_and_excludes_backend_and_source_values():
    def hashes():
        return {
            str(p.relative_to(preview.OUT)): sha256(p.read_bytes()).hexdigest()
            for p in preview.OUT.rglob("*")
            if p.is_file()
        }

    preview.build()
    first = hashes()
    preview.build()
    assert hashes() == first
    assert len(first) == 122
    assert not any(
        Path(p).suffix in {".py", ".dcm", ".env", ".toml", ".yml", ".map"} for p in first
    )
    for path in (preview.OUT / "samples").glob("*.json"):
        data = json.loads(path.read_text())
        assert set(data) == {
            "id",
            "title",
            "source",
            "preparation",
            "image",
            "pixels",
            "pixel_sha256",
            "metadata",
        }
        assert set(data["metadata"]) == {"prepared_at_build_time", "policy", "counts", "actions"}
        assert all(set(a) == {"tag", "field", "action"} for a in data["metadata"]["actions"])
        assert "FAKE-PATIENT" not in path.read_text()
        assert "SYNTHETIC^EXAMPLE" not in path.read_text()
    html = (preview.OUT / "index.html").read_text()
    assert 'type="file"' not in html and "<form" not in html
    assert "load from your computer" not in html
    assert "Content-Security-Policy" in html and "unsafe-inline" not in html
    assert 'href="/' not in html and 'src="/' not in html
    assert "/api/" not in (preview.OUT / "preview.js").read_text()
