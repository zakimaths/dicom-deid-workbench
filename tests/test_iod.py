from io import BytesIO
import pydicom
import pytest
from dicom_workbench.core import transform, read, Unsupported
from dicom_workbench.samples import sample_dicom
from dicom_workbench.collection import transform_collection


def encode(ds):
    stream = BytesIO()
    pydicom.dcmwrite(stream, ds, enforce_file_format=True)
    return stream.getvalue()


@pytest.mark.parametrize("key", ["ScanningSequence", "SequenceVariant"])
def test_missing_type_one_mr_rejected(key):
    ds = read(sample_dicom("mr"))
    del ds[key]
    with pytest.raises(Unsupported, match="Required MR"):
        transform(encode(ds))


@pytest.mark.parametrize(
    "key,value",
    [
        ("ScanningSequence", "FAKE NAME"),
        ("SequenceVariant", ["NONE", "SP"]),
        ("ScanningSequence", ["SE", "GR"]),
        ("MRAcquisitionType", ["2D", "3D"]),
        ("ScanOptions", "FAKE"),
    ],
)
def test_untrusted_codes_rejected(key, value):
    ds = read(sample_dicom("mr"))
    setattr(ds, key, value)
    with pytest.raises(Unsupported):
        transform(encode(ds))


def test_empty_type_two_and_required_codes_preserved():
    ds = read(sample_dicom("mr"))
    ds.EchoTrainLength = None
    result = read(transform(encode(ds)).dicom)
    for key in ["ScanningSequence", "SequenceVariant", "ScanOptions", "MRAcquisitionType"]:
        assert result[key] == ds[key]
    assert "EchoTrainLength" in result and result["EchoTrainLength"].is_empty
    assert len(result.ImageType) == 3


def test_collection_consistent_and_role_collisions_repaired():
    a = read(sample_dicom("mr-a"))
    from copy import deepcopy

    b = deepcopy(a)
    b.SOPInstanceUID = b.file_meta.MediaStorageSOPInstanceUID = pydicom.uid.generate_uid()
    outputs = transform_collection([encode(a), encode(b)])
    x, y = [read(o.dicom) for o in outputs]
    assert x.StudyInstanceUID == y.StudyInstanceUID
    assert x.SeriesInstanceUID == y.SeriesInstanceUID
    assert x.FrameOfReferenceUID == y.FrameOfReferenceUID
    assert x.StudyInstanceUID != x.FrameOfReferenceUID
    assert x.SOPInstanceUID != y.SOPInstanceUID
    assert a.PixelData == x.PixelData and b.PixelData == y.PixelData
    with pytest.raises(Unsupported, match="Duplicate"):
        transform_collection([encode(a), encode(a)])
    b.StudyInstanceUID = pydicom.uid.generate_uid()
    with pytest.raises(Unsupported, match="Mixed"):
        transform_collection([encode(a), encode(b)])


@pytest.mark.parametrize(
    "sequence,options,required", [("IR", "", "InversionTime"), ("SE", "CG", "TriggerTime")]
)
def test_conditional_mr_empty_fields(sequence, options, required):
    ds = read(sample_dicom("mr"))
    ds.ScanningSequence = sequence
    ds.ScanOptions = options
    if required in ds:
        del ds[required]
    result = read(transform(encode(ds)).dicom)
    assert required in result and result[required].is_empty


def test_invalid_coded_vr_and_image_type_fail():
    ds = read(sample_dicom("mr"))
    ds["ScanningSequence"].VR = "LO"
    with pytest.raises(Unsupported):
        transform(encode(ds))
    ds = read(sample_dicom("mr"))
    ds.ImageType = ["DERIVED", "SECONDARY", "FAKE NAME"]
    with pytest.raises(Unsupported):
        transform(encode(ds))


def test_postwrite_contract_rejects_missing_type_two():
    from dicom_workbench.verification import verify_metadata

    ds = read(sample_dicom("mr"))
    output = read(transform(sample_dicom("mr")).dicom)
    del output.EchoTrainLength
    with pytest.raises(Unsupported, match="required output"):
        verify_metadata(output, ds)
