"""Check actual browser downloads with independent byte-level header and NumPy payload expectations."""

import gzip
from hashlib import sha256
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

ROOT = Path("output/nifti-browser")
results = []
for path in sorted(ROOT.glob("*.nii")):
    data = path.read_bytes()
    assert data[:4] == struct.pack("<i", 348) and data[344:348] == b"n+1\0"
    assert struct.unpack_from("<8h", data, 40) == (3, 32, 40, 48, 1, 1, 1, 1)
    assert struct.unpack_from("<f", data, 108)[0] == 352
    assert data[148:252] == bytes(104) and data[328:344] == bytes(16)
    assert data[348:352] == bytes(4) and b"FAKE" not in data
    expected = np.zeros((32, 40, 48), dtype="<i2")
    expected[4:28, 5:35, 6:42] = 80
    expected[4:10, 15:25, 15:33] = 160
    expected[22:28, 12:28, 12:36] = 240
    assert data[352:] == expected.tobytes(order="F")
    assert struct.unpack_from("<2h", data, 252) == (1, 1)
    assert np.array_equal(
        np.array(struct.unpack_from("<12f", data, 280)).reshape(3, 4),
        [[2, 0, 0, -32], [0, 3, 0, -60], [0, 0, 4, -96]],
    )
    results.append(
        {
            "file": path.name,
            "voxel_count": expected.size,
            "all_voxels_equal": True,
            "header_removed": True,
            "geometry_equal": True,
        }
    )
assert len(results) == 9, "Expected downloads from three engines at three widths"
(ROOT / "export-verification.json").write_text(json.dumps(results, indent=2) + "\n")
print(f"{len(results)} actual NIfTI downloads verified, each with {expected.size} unchanged voxels")

orientation = []
for path in sorted(ROOT.glob("*-orientation.png")):
    pixels = np.array(Image.open(path).convert("RGB"))
    height, width = pixels.shape[:2]
    pixels = pixels[height // 5 : 4 * height // 5, width // 10 : 9 * width // 10]
    white = (
        (pixels[:, :, 0] > 220)
        & (abs(pixels[:, :, 0].astype(int) - pixels[:, :, 1]) < 3)
        & (abs(pixels[:, :, 0].astype(int) - pixels[:, :, 2]) < 3)
    )
    _, x = np.where(white)
    assert len(x) > 100 and x.mean() < pixels.shape[1] / 2, path.name
    orientation.append({"file": path.name, "bright_right_marker_on_picture_left": True})
assert len(orientation) == 9
(ROOT / "orientation-verification.json").write_text(json.dumps(orientation, indent=2) + "\n")
print("9 rendered left/right orientation fixtures verified")

# Independently parse actual removal downloads without calling the defacer or NiBabel.

assets = Path("src/dicom_workbench/web/nifti-assets")
before = gzip.decompress((assets / "deface-before.nii.gz").read_bytes())
brain = gzip.decompress((assets / "deface-brain.nii.gz").read_bytes())
original_values = np.frombuffer(before, dtype="<u2", offset=352)
protected = np.frombuffer(brain, dtype="u1", offset=352).astype(bool)
deface_results = []
for path in sorted(Path("output/nifti-deface").glob("local-*.nii")):
    if path.name.endswith(".mask.nii"):
        continue
    saved = path.read_bytes()
    selected_file = path.with_suffix(".mask.nii").read_bytes()
    selected = np.frombuffer(selected_file, dtype="u1", offset=352).astype(bool)
    after_values = np.frombuffer(saved, dtype="<u2", offset=352)
    report = json.loads(path.with_suffix(".json").read_text())
    assert len(saved) == len(before) and saved[:352] == before[:352]
    assert selected_file[40:56] == before[40:56]
    assert selected_file[252:328] == before[252:328]
    assert not (selected & protected).any()
    assert np.array_equal(after_values[~selected], original_values[~selected])
    assert np.array_equal(after_values[protected], original_values[protected])
    assert not after_values[selected].any()
    changed = int(np.count_nonzero(original_values != after_values))
    assert changed == report["changed_voxels"] == 67221
    assert sha256(saved).hexdigest() == report["output_sha256"]
    assert sha256(selected_file).hexdigest() == report["removal_mask_sha256"]
    deface_results.append(
        {
            "file": path.name,
            "changed_voxels": changed,
            "provided_mask_preserved": True,
            "outside_removal_unchanged": True,
            "geometry_equal": True,
        }
    )
assert len(deface_results) == 9, "Expected nine actual local removal downloads"
Path("output/nifti-deface/export-verification.json").write_text(
    json.dumps(deface_results, indent=2) + "\n"
)
print("9 actual removal downloads independently verified against source voxels and supplied mask")
