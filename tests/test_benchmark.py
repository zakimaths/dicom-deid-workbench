from hashlib import sha256
import importlib.util
from pathlib import Path
import pytest
from dicom_workbench.fixtures import synthetic_dicom

spec = importlib.util.spec_from_file_location(
    "benchmark", Path(__file__).parents[1] / "scripts/benchmark_dicom.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_benchmark_never_hides_denominator_or_source_names(tmp_path):
    good = synthetic_dicom()
    (tmp_path / "PRIVATE_NAME.dcm").write_bytes(good)
    (tmp_path / "bad.dcm").write_bytes(b"bad")
    manifest = {
        "schema": 1,
        "split": "test",
        "cases": [
            {"path": "PRIVATE_NAME.dcm", "sha256": sha256(good).hexdigest()},
            {"path": "bad.dcm", "sha256": sha256(b"bad").hexdigest()},
            {"path": "missing.dcm", "sha256": "a" * 64},
        ],
    }
    r = module.run_manifest(manifest, tmp_path)
    assert r["total"] == 3 and r["counts"]["accepted"] == 1
    assert r["counts"]["rejected_by_contract"] == 1 and r["counts"]["unavailable"] == 1
    assert "PRIVATE_NAME" not in str(r) and "SYNTHETIC" not in str(r)
    manifest["cases"][0]["path"] = "../outside.dcm"
    with pytest.raises(ValueError):
        module.run_manifest(manifest, tmp_path)
