"""Adversarial regressions from the September audit; synthetic data only."""

from io import BytesIO

import numpy as np
import pydicom
import pytest

from dicom_workbench.core import KEEP_NUMERIC, Unsupported, read, transform
from dicom_workbench.fixtures import synthetic_dicom
from dicom_workbench.verification import verify_metadata


def encode(ds):
    stream = BytesIO()
    pydicom.dcmwrite(stream, ds, enforce_file_format=True)
    return stream.getvalue()


@pytest.mark.parametrize(
    "key,value",
    [
        ("BurnedInAnnotation", ["NO", "YES"]),
        ("RecognizableVisualFeatures", ["NO", "YES"]),
        ("BurnedInAnnotation", "UNKNOWN"),
        ("KVP", [100, 120]),
        ("ImagePositionPatient", [1, 2]),
        ("ImageOrientationPatient", [1, 0, 0]),
        ("AcquisitionMatrix", [1, 2]),
        ("WindowWidth", [400, 0]),
    ],
)
def test_invalid_multiplicity_and_declarations_fail_closed(key, value):
    ds = read(synthetic_dicom())
    setattr(ds, key, value)
    with pytest.raises(Unsupported):
        transform(encode(ds))


def test_control_field_disguised_as_text_is_rejected():
    ds = read(synthetic_dicom())
    ds["PhotometricInterpretation"].VR = "LO"
    with pytest.raises(Unsupported):
        transform(encode(ds))


def test_every_retained_numeric_field_is_required_in_output():
    source = read(synthetic_dicom())
    for key in KEEP_NUMERIC & set(source.dir()):
        out = read(transform(synthetic_dicom()).dicom)
        del out[key]
        with pytest.raises(Unsupported):
            verify_metadata(out, source)


@pytest.mark.parametrize(
    "key,value",
    [
        ("TransferSyntaxUID", pydicom.uid.ImplicitVRLittleEndian),
        ("MediaStorageSOPInstanceUID", "2.25.123"),
        ("MediaStorageSOPClassUID", pydicom.uid.MRImageStorage),
        ("FileMetaInformationVersion", b"\x00\x02"),
        ("ImplementationVersionName", "INJECTED"),
    ],
)
def test_file_meta_contract_checks_values(key, value):
    source = read(synthetic_dicom())
    out = read(transform(synthetic_dicom()).dicom)
    setattr(out.file_meta, key, value)
    with pytest.raises(Unsupported):
        verify_metadata(out, source)


def test_seeded_random_regions_against_numpy_oracle():
    rng = np.random.default_rng(20260905)
    for case in range(100):
        ds = read(synthetic_dicom())
        ds.Rows, ds.Columns = rows, cols = tuple(int(v) for v in rng.integers(1, 40, 2))
        signed, invert, slope = bool(case % 2), bool(case % 3), (-1 if case % 5 else 1)
        ds.PixelRepresentation = int(signed)
        ds.PhotometricInterpretation = "MONOCHROME1" if invert else "MONOCHROME2"
        ds.RescaleSlope = slope
        low, high = (-32768, 32767) if signed else (0, 65535)
        original = rng.integers(low, high + 1, (rows, cols), dtype=np.int32)
        ds.PixelData = original.astype("<i2" if signed else "<u2").tobytes()
        boxes, mask = [], np.zeros((rows, cols), dtype=bool)
        for _ in range(int(rng.integers(1, 33))):
            x, y = int(rng.integers(cols)), int(rng.integers(rows))
            w, h = int(rng.integers(1, cols - x + 1)), int(rng.integers(1, rows - y + 1))
            boxes.append(dict(x=x, y=y, width=w, height=h))
            mask[y : y + h, x : x + w] = True
        result = transform(encode(ds), regions=boxes)
        expected = original.copy()
        expected[mask] = high if invert != (slope < 0) else low
        np.testing.assert_array_equal(read(result.dicom).pixel_array, expected)
        assert result.report["redaction"]["selected_pixels"] == int(mask.sum())
        assert result.report["redaction"]["changed_pixels"] == int((expected != original).sum())


def test_duplicate_dicom_identity_flag_is_rejected_before_parser_collapses_it():
    ds = read(synthetic_dicom())
    ds.BurnedInAnnotation = "NO"
    data = encode(ds)
    field = b"\x28\x00\x01\x03CS\x02\x00NO"
    assert data.count(field) == 1
    # Two occurrences of the same tag: YES followed by NO.
    data = data.replace(field, field[:-2] + b"YES " + field, 1)
    # Repair the first value length to make both fields individually well-formed.
    data = data.replace(b"CS\x02\x00YES ", b"CS\x04\x00YES ", 1)
    with pytest.raises(Unsupported, match="structure"):
        transform(data)


def test_deflated_dataset_is_rejected_before_pydicom_reads_it(monkeypatch):
    ds = read(synthetic_dicom())
    ds.file_meta.TransferSyntaxUID = pydicom.uid.DeflatedExplicitVRLittleEndian
    data = encode(ds)

    def unexpected(*args, **kwargs):
        pytest.fail("Unsupported compression reached pydicom")

    monkeypatch.setattr(pydicom, "dcmread", unexpected)
    with pytest.raises(Unsupported, match="uncompressed"):
        transform(data)


@pytest.mark.parametrize(
    "undefined_sequence,undefined_item",
    [(False, False), (True, False), (True, True), (False, True)],
)
def test_valid_sequence_length_encodings_remain_supported(undefined_sequence, undefined_item):
    ds = read(synthetic_dicom())
    child = pydicom.Dataset()
    child.PatientID = "NESTED-SYNTHETIC-TRAP"
    child.is_undefined_length_sequence_item = undefined_item
    ds.ReferencedStudySequence = [child]
    ds["ReferencedStudySequence"].is_undefined_length = undefined_sequence
    result = transform(encode(ds))
    assert b"NESTED-SYNTHETIC-TRAP" not in result.dicom


@pytest.mark.parametrize(
    "filename",
    [
        "MR_small_implicit.dcm",
        "MR_small_bigendian.dcm",
        "MR_small_RLE.dcm",
        "MR_truncated.dcm",
        "CT_small.dcm",
        "MR_small.dcm",
        "examples_overlay.dcm",
        "image_dfl.dcm",
    ],
)
def test_public_unsupported_corpus_is_rejected_without_runtime_download(filename):
    from pathlib import Path

    path = Path(pydicom.__file__).parent / "data/test_files" / filename
    with pytest.raises(Unsupported):
        transform(path.read_bytes())


def test_bounded_preflight_truncations_and_seeded_random_headers():
    rng = np.random.default_rng(8341)
    data = synthetic_dicom()
    for cut in np.linspace(132, len(data) - 1, 100, dtype=int):
        with pytest.raises(Unsupported):
            transform(data[:cut])
    for _ in range(200):
        raw = b"\0" * 128 + b"DICM" + rng.bytes(int(rng.integers(0, 1024)))
        with pytest.raises(Unsupported):
            transform(raw)


def test_maximum_dimensions_and_rectangle_count():
    ds = read(synthetic_dicom())
    ds.Rows = ds.Columns = 1024
    ds.PixelData = np.arange(1024 * 1024, dtype="<i2").tobytes()
    boxes = [dict(x=n * 32, y=n * 32, width=32, height=32) for n in range(32)]
    result = transform(encode(ds), regions=boxes)
    expected = ds.pixel_array.copy()
    for n in range(32):
        expected[n * 32 : (n + 1) * 32, n * 32 : (n + 1) * 32] = -32768
    np.testing.assert_array_equal(read(result.dicom).pixel_array, expected)
    assert result.report["redaction"]["selected_pixels"] == 32768
