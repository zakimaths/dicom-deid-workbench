from hashlib import sha256
from io import BytesIO
import gzip
import json
from pathlib import Path
import struct

import nibabel as nib
import numpy as np
import pytest

from dicom_workbench.core import Unsupported
from dicom_workbench.nifti import inspect, decode
from dicom_workbench.nifti_fixtures import phantom


@pytest.mark.parametrize("endian", ["<", ">"])
@pytest.mark.parametrize("dtype", [np.uint8, np.int16, np.uint16, np.float32])
def test_preserves_raw_scaled_geometry_and_removes_text(endian, dtype):
    raw = phantom(endian, dtype)
    before = nib.Nifti1Image.from_bytes(raw)
    result = inspect(raw)
    after = nib.Nifti1Image.from_bytes(result.data)
    assert np.array_equal(before.dataobj.get_unscaled(), after.dataobj.get_unscaled())
    assert np.array_equal(before.get_fdata(), after.get_fdata())
    assert np.array_equal(before.affine, after.affine)
    assert result.report["text_fields_present"] == ["descrip", "aux_file", "intent_name"]
    assert result.report["extensions_removed"] == 1
    assert b"FAKE" not in result.data and not after.header.extensions
    assert "FAKE" not in json.dumps(result.report)
    assert inspect(result.data).data == result.data
    assert result.report["output_sha256"] == sha256(result.data).hexdigest()


def test_scaling_dual_spaces_and_oblique_orientation_preserved():
    raw = phantom()
    im = nib.Nifti1Image.from_bytes(raw)
    q = np.array([[2, 0, 0, -30], [0, 2.4, -2.4, 1], [0, 1.8, 3.2, 3], [0, 0, 0, 1.0]])
    s = q.copy()
    s[:3, 3] += 20
    im.set_qform(q, 1)
    im.set_sform(s, 4)
    im.header.set_slope_inter(2.5, -90)
    raw = im.to_bytes()
    result = inspect(raw)
    before, after = nib.Nifti1Image.from_bytes(raw), nib.Nifti1Image.from_bytes(result.data)
    assert np.array_equal(before.get_fdata(), after.get_fdata())
    assert np.array_equal(before.get_qform(), after.get_qform())
    assert np.array_equal(before.get_sform(), after.get_sform())
    assert result.summary["dual_spaces"]


def test_gzip_wrapper_padding_unused_and_trailing_bytes_are_not_copied():
    raw = bytearray(phantom())
    raw[4:16] = b"FAKE UNUSED!"
    raw += b"FAKE TRAILING"
    stream = BytesIO()
    with gzip.GzipFile(filename="FAKE-NAME.nii", fileobj=stream, mode="wb", mtime=12345) as f:
        f.write(raw)
    result = inspect(stream.getvalue())
    assert b"FAKE" not in result.data and result.data[4:39] == bytes(35)
    assert not result.data.startswith(b"\x1f\x8b")  # Export is a fresh, plain .nii.


@pytest.mark.parametrize(
    "offset,fmt,value",
    [
        (0, "i", 540),
        (40, "h", 4),
        (42, "h", 0),
        (42, "h", 513),
        (48, "h", 2),
        (70, "h", 64),
        (72, "h", 8),
        (68, "h", 1002),
        (108, "f", 353),
        (108, "f", float("inf")),
        (80, "f", 0),
        (80, "f", float("nan")),
        (123, "B", 0),
        (123, "B", 1),
        (123, "B", 3),
        (252, "h", 99),
        (356, "i", 0),
    ],
)
def test_invalid_headers_rejected(offset, fmt, value):
    raw = bytearray(phantom())
    # Extension length, rather than its code, lives at byte 352.
    if offset == 356:
        offset = 352
    struct.pack_into("<" + fmt, raw, offset, value)
    with pytest.raises(Unsupported):
        inspect(bytes(raw))


def test_truncation_conflicting_handedness_and_nonfinite_payload():
    with pytest.raises(Unsupported):
        inspect(phantom()[:-1])
    raw = bytearray(phantom())
    struct.pack_into("<f", raw, 280, -2)
    with pytest.raises(Unsupported):
        inspect(bytes(raw))
    raw = bytearray(phantom(datatype=np.float32))
    offset = int(struct.unpack_from("<f", raw, 108)[0])
    struct.pack_into("<f", raw, offset, float("nan"))
    with pytest.raises(Unsupported):
        inspect(bytes(raw))


def test_bounded_gzip_and_multiple_members(monkeypatch):
    import dicom_workbench.nifti as module

    monkeypatch.setattr(module, "MAX_DECODED", 1024)
    with pytest.raises(Unsupported):
        decode(gzip.compress(b"0" * 2048))
    with pytest.raises(Unsupported):
        decode(gzip.compress(b"one") + gzip.compress(b"two"))
    with pytest.raises(Unsupported):
        decode(gzip.compress(b"one")[:-3])


def test_bundled_samples_and_vendor_have_pinned_hashes():
    root = Path("src/dicom_workbench/web/nifti-assets")
    for sample in json.loads((root / "samples.json").read_text()):
        raw = (root / sample["file"]).read_bytes()
        assert sha256(raw).hexdigest() == sample["sha256"]
        assert inspect(raw).summary == sample["summary"]
    vendor = json.loads((root / "vendor.json").read_text())
    assert sha256((root / "niivue-0.69.0.js").read_bytes()).hexdigest() == vendor["sha256"]
