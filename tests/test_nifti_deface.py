import gzip
from hashlib import sha256
import itertools
import json
from pathlib import Path
import struct

import nibabel as nib
import numpy as np
import pytest

from dicom_workbench.core import Unsupported
from dicom_workbench.nifti import inspect
from dicom_workbench.nifti_deface import deface, process_request


def encode(values, affine=None):
    image = nib.Nifti1Image(values, np.diag([2.0, 3.0, 2.5, 1.0]) if affine is None else affine)
    image.header.set_xyzt_units("mm")
    return image.to_bytes()


def pair():
    x, y, z = np.indices((29, 37, 41))
    brain = ((x - 14) ** 2 / 9**2 + (y - 17) ** 2 / 12**2 + (z - 26) ** 2 / 10**2 < 1).astype(
        np.uint8
    )
    # Non-symmetric intensities make indexing/permutation errors visible.
    values = (x + 3 * y + 7 * z + 1).astype(np.uint16)
    return encode(values), encode(brain)


def values(raw):
    return np.asarray(nib.Nifti1Image.from_bytes(raw).dataobj)


def test_saved_region_and_protected_voxels_independently():
    before, brain = pair()
    result = deface(before, brain)
    selection = values(result.mask).astype(bool)
    original, after = values(before), values(result.data)
    protected = values(brain).astype(bool)
    assert selection.any() and (~selection).any()
    assert not (selection & protected).any()
    assert np.array_equal(original[~selection], after[~selection])
    assert np.array_equal(original[protected], after[protected])
    assert not after[selection].any()
    assert result.report["changed_voxels"] == np.count_nonzero(original != after)
    assert result.report["output_sha256"] == sha256(result.data).hexdigest()
    assert result.data[:352] == inspect(before).data[:352]
    assert result == deface(before, brain)
    larger_margin = values(deface(before, brain, 10).mask).astype(bool)
    assert not (larger_margin & ~selection).any()


@pytest.mark.parametrize("dtype", ["u1", "<i2", ">i2", "<u2", ">u2", "<f4", ">f4"])
def test_storage_types_preserve_values_and_endianness(dtype):
    before, brain = pair()
    a = nib.Nifti1Image.from_bytes(before)
    h = a.header.as_byteswapped(">" if dtype.startswith(">") else "<")
    h.set_data_dtype(dtype)
    h["vox_offset"] = 352
    raw = h.binaryblock + bytes(4) + values(before).astype(dtype).tobytes(order="F")
    result = deface(raw, brain)
    selected = values(result.mask).astype(bool)
    expected = values(raw).copy()
    expected[selected] = 0
    assert np.array_equal(values(result.data), expected)
    assert result.data[:352] == inspect(raw).data[:352]


@pytest.mark.parametrize(
    "order,signs",
    itertools.product(itertools.permutations(range(3)), itertools.product([-1, 1], repeat=3)),
)
def test_all_48_storage_orientations_have_same_world_removal(order, signs):
    before, brain = pair()
    reference = deface(before, brain)
    transform = np.array(list(zip(order, signs)), dtype=float)
    a, b = [nib.Nifti1Image.from_bytes(raw).as_reoriented(transform) for raw in (before, brain)]
    result = deface(a.to_bytes(), b.to_bytes())
    expected = nib.orientations.apply_orientation(values(reference.data), transform)
    assert np.array_equal(values(result.data), expected)
    assert result.report["changed_voxels"] == reference.report["changed_voxels"]


@pytest.mark.parametrize("margin", [True, 0, 1.99, 20.01, float("nan"), float("inf"), "5"])
def test_bad_margins(margin):
    with pytest.raises(Unsupported):
        deface(*pair(), margin)


@pytest.mark.parametrize(
    "fault",
    [
        "empty",
        "full",
        "edge",
        "nonbinary",
        "wrong_shape",
        "shift",
        "negative",
        "scaled",
        "oblique",
        "dual_space",
        "no_changes",
    ],
)
def test_unsupported_pairs_fail_closed(fault):
    before, mask = pair()
    a, b = values(before).copy(), values(mask).copy()
    affine = nib.Nifti1Image.from_bytes(before).affine.copy()
    if fault == "empty":
        b[:] = 0
    if fault == "full":
        b[:] = 1
    if fault == "edge":
        b[0, 10, 20] = 1
    if fault == "nonbinary":
        b[14, 17, 26] = 2
    if fault == "wrong_shape":
        b = b[:-1]
    if fault == "shift":
        affine[0, 3] = 1
    if fault == "negative":
        a = a.astype(np.int16)
        a[0, 0, 0] = -1
    if fault == "no_changes":
        a[:] = 0
    if fault == "oblique":
        affine[0, 1] = 0.2
    before, mask = encode(a), encode(b, affine)
    if fault == "scaled":
        data = bytearray(before)
        struct.pack_into("<f", data, 112, 2)
        before = bytes(data)
    if fault == "dual_space":
        img = nib.Nifti1Image.from_bytes(before)
        affine[0, 3] = 1
        img.set_qform(affine, 1)
        before = img.to_bytes()
    with pytest.raises(Unsupported):
        deface(before, mask)


def test_framing_and_gzip():
    a, b = [gzip.compress(raw, mtime=0) for raw in pair()]
    request = struct.pack("<4sIIf", b"NDF1", len(a), len(b), 5) + a + b
    response = process_request(request)
    magic, meta_len, out_len, mask_len = struct.unpack_from("<4sIII", response)
    assert magic == b"NDR1" and len(response) == 16 + meta_len + out_len + mask_len
    meta = json.loads(response[16 : 16 + meta_len])
    assert (
        sha256(response[16 + meta_len : 16 + meta_len + out_len]).hexdigest()
        == meta["report"]["output_sha256"]
    )
    for bad in (b"", request[:-1], request + b"x", b"BAD!" + request[4:]):
        with pytest.raises(Unsupported):
            process_request(bad)


def test_public_template_is_reproducible_and_has_honest_denominators():
    root = Path("src/dicom_workbench/web/nifti-assets")
    demo = json.loads((root / "deface-demo.json").read_text())
    files = {}
    for name, info in demo["files"].items():
        raw = (root / info["file"]).read_bytes()
        assert raw[4:8] == bytes(4) and raw[9] == 255
        assert sha256(raw).hexdigest() == info["sha256"]
        assert inspect(raw).summary == info["summary"]
        files[name] = raw
    result = deface(files["before"], files["brain"])
    assert result.data == gzip.decompress(files["after"])
    assert result.mask == gzip.decompress(files["removal"])
    assert result.report == demo["report"]
    assert demo["atlas_region_overlap"]["face"]["outside_removal"] > 0
