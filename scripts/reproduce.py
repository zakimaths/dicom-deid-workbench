"""Regenerate a synthetic case and record checks without exporting identifiers."""

from hashlib import sha256
import json
from pathlib import Path
import platform
import sys

import pydicom

from dicom_workbench import __version__
from dicom_workbench.core import read, transform
from dicom_workbench.fixtures import synthetic_dicom
from dicom_workbench.samples import SAMPLES, sample_dicom


def main():
    original = synthetic_dicom()
    result = transform(original)
    source, exported = read(original), read(result.dicom)
    assert source.PixelData == exported.PixelData
    assert str(exported.PatientName) == ""
    assert str(exported.PatientID) == ""
    assert exported.preamble == bytes(128)
    assert not any(element.VR == "SQ" or element.tag.is_private for element in exported)
    assert source.SOPInstanceUID != exported.SOPInstanceUID
    assert exported.SOPInstanceUID == exported.file_meta.MediaStorageSOPInstanceUID
    assert original == synthetic_dicom()
    semantic_report = {k: v for k, v in result.report.items() if k != "output_sha256"}
    challenge = synthetic_dicom(with_text=True)
    erased = transform(challenge, regions=[{"x": 16, "y": 12, "width": 132, "height": 14}])
    assert erased.report["redaction"]["selected_pixels"] == 1848
    assert erased.report["redaction"]["outside_regions_unchanged"]
    public_digests = {}
    for key, spec in SAMPLES.items():
        prepared = sample_dicom(key)
        sample_result = transform(prepared)
        assert sample_result.pixels == read(prepared).PixelData
        public_digests[key] = {
            "upstream_sha256": spec["sha256"],
            "preserved_pixel_sha256": sha256(sample_result.pixels).hexdigest(),
        }
    manifest = {
        "public_samples": public_digests,
        "app_version": __version__,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "pydicom": pydicom.__version__,
        "policy": result.report["policy"],
        "text_fixture_sha256": sha256(challenge).hexdigest(),
        "redacted_pixel_sha256": sha256(erased.pixels).hexdigest(),
        "fixture_sha256": sha256(original).hexdigest(),
        "pixel_sha256": sha256(result.pixels).hexdigest(),
        "report_sha256": sha256(json.dumps(semantic_report, sort_keys=True).encode()).hexdigest(),
        "checks": {
            "pixel_bytes_preserved": True,
            "output_reopened": True,
            "identity_fields_emptied": True,
            "nested_and_private_fields_removed": True,
            "new_instance_id": True,
            "fixture_repeatable": True,
        },
        "limits": "Synthetic and pinned public fixtures only. Pixel identity, full IOD validity and clinical use not validated.",
    }
    out = Path("output/reproduction.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
