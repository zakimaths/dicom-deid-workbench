from io import BytesIO
import json

import numpy as np
import pydicom
import pytest

from dicom_workbench.core import Unsupported, read, transform
from dicom_workbench.fixtures import synthetic_dicom
from dicom_workbench.redaction import verify_pixels
from dicom_workbench.verification import verify_metadata


def encoded(ds):
    stream = BytesIO()
    pydicom.dcmwrite(stream, ds, enforce_file_format=True)
    return stream.getvalue()


@pytest.mark.parametrize(
    "signed,invert,slope",
    [(s, i, m) for s in [False, True] for i in [False, True] for m in [-1, 1]],
)
def test_rectangles_verified_independently(signed, invert, slope):
    ds = read(synthetic_dicom())
    ds.PixelRepresentation = int(signed)
    ds.PhotometricInterpretation = "MONOCHROME1" if invert else "MONOCHROME2"
    ds.RescaleSlope = slope
    # Sentinel-shaped data inside the selection; edge, overlap and single-pixel boxes.
    boxes = [
        {"x": 0, "y": 0, "width": 10, "height": 8},
        {"x": 5, "y": 4, "width": 12, "height": 9},
        {"x": 255, "y": 255, "width": 1, "height": 1},
    ]
    result = transform(encoded(ds), regions=boxes)
    out = pydicom.dcmread(BytesIO(result.dicom))
    mask = np.zeros((256, 256), dtype=bool)
    for b in boxes:
        mask[b["y"] : b["y"] + b["height"], b["x"] : b["x"] + b["width"]] = True
    expected_fill = (
        (32767 if signed else 65535) if invert != (slope < 0) else (-32768 if signed else 0)
    )
    assert np.all(out.pixel_array[mask] == expected_fill)
    np.testing.assert_array_equal(out.pixel_array[~mask], ds.pixel_array[~mask])
    assert result.report["redaction"]["selected_pixels"] == int(mask.sum())
    assert result.report["redaction"]["outside_regions_unchanged"]
    assert result.report["pixel_review"] == "selected_regions_only"
    assert "PatientIdentityRemoved" not in out and "BurnedInAnnotation" not in out
    assert result.report["verification"]["iod_validation"] == "not_performed"


@pytest.mark.parametrize(
    "regions",
    [
        [],
        {},
        [None],
        [{"x": True, "y": 0, "width": 1, "height": 1}],
        [{"x": -1, "y": 0, "width": 1, "height": 1}],
        [{"x": 0, "y": 0, "width": 257, "height": 1}],
        [{"x": 0.1, "y": 0, "width": 1, "height": 1}],
        [{"x": 0, "y": 0, "width": 0, "height": 1}],
        [{"x": 0, "y": 0, "width": 1, "height": 1}] * 33,
    ],
)
def test_invalid_selections_fail_closed(regions):
    with pytest.raises(Unsupported):
        transform(synthetic_dicom(), regions=regions)


def test_verifier_detects_wrong_selection_and_outside_mutations():
    ds = read(synthetic_dicom())
    boxes = [{"x": 0, "y": 0, "width": 2, "height": 2}]
    result = transform(synthetic_dicom(), regions=boxes)
    args = (ds.Rows, ds.Columns, boxes, -32768, True)
    with pytest.raises(Unsupported, match="not erased"):
        verify_pixels(ds.PixelData, ds.PixelData, *args)
    corrupt = bytearray(result.pixels)
    corrupt[-1] ^= 1
    with pytest.raises(Unsupported, match="outside"):
        verify_pixels(ds.PixelData, bytes(corrupt), *args)


@pytest.mark.parametrize("mutation", ["private", "name", "preamble", "uid", "sequence", "vr"])
def test_metadata_assertions_reject_corrupted_output(mutation):
    ds = read(synthetic_dicom())
    out = read(transform(synthetic_dicom()).dicom)
    if mutation == "private":
        out.add_new(0x00110010, "LO", "TRAP")
    elif mutation == "name":
        out.PatientName = "TRAP^NAME"
    elif mutation == "preamble":
        out.preamble = b"TRAP".ljust(128, b"\0")
    elif mutation == "uid":
        out.StudyInstanceUID = ds.StudyInstanceUID
    elif mutation == "sequence":
        out.ReferencedStudySequence = [pydicom.Dataset()]
    else:
        out["KVP"].VR = "LO"
    with pytest.raises(Unsupported):
        verify_metadata(out, ds)


def test_numeric_tag_with_text_vr_rejected():
    ds = read(synthetic_dicom())
    ds["KVP"].VR = "LO"
    ds["KVP"].value = "120"
    with pytest.raises(Unsupported, match="representation"):
        transform(encoded(ds))


def test_reports_never_contain_original_identifiers():
    result = transform(synthetic_dicom(), regions=[{"x": 0, "y": 0, "width": 2, "height": 2}])
    report = json.dumps(result.report)
    assert "FAKE-PATIENT" not in report and "SYNTHETIC^EXAMPLE" not in report


def test_entire_fake_text_exercise_is_erased():
    data = synthetic_dicom(with_text=True)
    assert data == synthetic_dicom(with_text=True)
    source = read(data)
    assert np.any(source.pixel_array == 2000)
    result = transform(data, regions=[{"x": 16, "y": 12, "width": 132, "height": 14}])
    out = read(result.dicom)
    assert not np.any(out.pixel_array == 2000)
    assert result.report["redaction"]["selected_pixels"] == 1848
    from hashlib import sha256

    assert sha256(result.dicom).hexdigest() == result.report["output_sha256"]
