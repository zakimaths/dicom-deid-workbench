from io import BytesIO
import json

import numpy as np
import pydicom
from pydicom.dataset import Dataset
from pydicom.sequence import Sequence
import pytest

from dicom_workbench.core import MAX_BYTES, Unsupported, read, transform
from dicom_workbench.fixtures import synthetic_dicom


def encode(ds):
    stream = BytesIO()
    pydicom.dcmwrite(stream, ds, enforce_file_format=True)
    return stream.getvalue()


def test_fixture_is_repeatable():
    assert synthetic_dicom() == synthetic_dicom()


def test_identity_traps_removed_and_pixels_unchanged():
    data = synthetic_dicom()
    source = read(data)
    result = transform(data)
    output = read(result.dicom)
    for key in (
        "PatientName",
        "PatientID",
        "PatientBirthDate",
        "StudyDate",
        "ReferringPhysicianName",
    ):
        assert str(output[key].value) == ""
    assert "RequestAttributesSequence" not in output
    assert "InstitutionName" not in output
    assert not any(element.tag.is_private for element in output.iterall())
    assert output.preamble == b"\0" * 128
    assert "SourceApplicationEntityTitle" not in output.file_meta
    assert "PatientIdentityRemoved" not in output
    assert "BurnedInAnnotation" not in output
    for sentinel in (
        b"SYNTHETIC^EXAMPLE",
        b"FAKE-PATIENT",
        b"NESTED^FAKE",
        b"FAKE_PRIVATE",
        b"SYNTHETIC_IDENTIFIER",
    ):
        assert sentinel not in result.dicom
        assert sentinel not in json.dumps(result.report).encode()
    assert source.PixelData == output.PixelData == result.pixels
    np.testing.assert_array_equal(source.pixel_array, output.pixel_array)
    for key in ("SOPInstanceUID", "StudyInstanceUID", "SeriesInstanceUID", "FrameOfReferenceUID"):
        assert output[key].value != source[key].value
        assert output[key].value.is_valid
    assert output.SOPClassUID == source.SOPClassUID
    assert output.file_meta.MediaStorageSOPInstanceUID == output.SOPInstanceUID
    assert result.report["pixel_review"] == "not_assessed"
    assert result.report["pixel_bytes_unchanged"]


def test_all_sequences_are_dropped_including_nested_unknowns():
    source = read(synthetic_dicom())
    inner = Dataset()
    inner.PatientID = "DEEPLY_NESTED_FAKE"
    outer = Dataset()
    outer.ReferencedStudySequence = Sequence([inner])
    source.ReferencedSeriesSequence = Sequence([outer])
    result = transform(encode(source))
    assert b"DEEPLY_NESTED_FAKE" not in result.dicom
    assert not any(e.VR == "SQ" for e in read(result.dicom))


def test_unknown_standard_text_is_not_retained():
    source = read(synthetic_dicom())
    source.AdditionalPatientHistory = "HIDDEN_FAKE_NAME"
    assert b"HIDDEN_FAKE_NAME" not in transform(encode(source)).dicom


def test_random_ids_do_not_change_semantic_results():
    first, second = transform(synthetic_dicom()), transform(synthetic_dicom())
    assert first.dicom != second.dicom
    assert first.report == second.report
    assert first.pixels == second.pixels


@pytest.mark.parametrize(
    "key,value",
    [
        ("NumberOfFrames", 2),
        ("BitsStored", 12),
        ("HighBit", 11),
        ("SamplesPerPixel", 3),
        ("PhotometricInterpretation", "RGB"),
        ("Rows", 1025),
        ("VOILUTFunction", "SIGMOID"),
        ("BurnedInAnnotation", "YES"),
        ("RecognizableVisualFeatures", "YES"),
        ("PixelPaddingValue", 0),
        ("RescaleSlope", 0),
        ("WindowWidth", 0),
        ("PresentationLUTShape", "INVERSE"),
        ("Modality", "US"),
    ],
)
def test_unsupported_fields_rejected(key, value):
    ds = read(synthetic_dicom())
    setattr(ds, key, value)
    if key == "PixelPaddingValue":
        ds[key].VR = "SS"
    with pytest.raises(Unsupported):
        transform(encode(ds))


def test_truncated_and_oversized_data_fail_without_data_in_error():
    for data in (b"SECRET_NAME", synthetic_dicom()[:-20], b"x" * (MAX_BYTES + 1)):
        with pytest.raises(Unsupported) as error:
            transform(data)
        assert "SECRET_NAME" not in str(error.value)


def test_implicit_vr_rejected():
    ds = read(synthetic_dicom())
    ds.file_meta.TransferSyntaxUID = pydicom.uid.ImplicitVRLittleEndian
    with pytest.raises(Unsupported, match="Explicit VR"):
        transform(encode(ds))


def test_mr_unsigned_and_inversion_metadata():
    ds = read(synthetic_dicom())
    ds.Modality = "MR"
    ds.SOPClassUID = ds.file_meta.MediaStorageSOPClassUID = pydicom.uid.MRImageStorage
    ds.PhotometricInterpretation = "MONOCHROME1"
    ds.PixelRepresentation = 0
    result = transform(encode(ds))
    assert result.image["invert"] is True
    assert result.image["signed"] is False


def test_missing_window_uses_none_for_browser_autorange():
    ds = read(synthetic_dicom())
    del ds.WindowCenter
    del ds.WindowWidth
    result = transform(encode(ds))
    assert result.image["width"] is None
    assert result.image["center"] is None


def test_metadata_instance_mismatch_rejected():
    ds = read(synthetic_dicom())
    ds.file_meta.MediaStorageSOPInstanceUID = "2.25.12345"
    # enforce_file_format normalises SOP identifiers, so change encoded value after writing.
    data = synthetic_dicom().replace(
        b"2.25.100000000000000000000000000000000001",
        b"2.25.100000000000000000000000000000000009",
        1,
    )
    with pytest.raises(Unsupported, match="identifier"):
        transform(data)
