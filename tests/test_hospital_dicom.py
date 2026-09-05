"""Real-origin public CT/MR containers with planted metadata identifiers.

This scores container removal, not clinical identity detection in original pixels.
"""

from io import BytesIO
import pydicom
from pydicom.dataset import Dataset
from pydicom.sequence import Sequence
from pydicom.uid import generate_uid
import pytest

from dicom_workbench.core import read, transform, Unsupported
from dicom_workbench.samples import sample_dicom
from dicom_workbench.collection import transform_collection


def encode(ds):
    result = BytesIO()
    pydicom.dcmwrite(result, ds, enforce_file_format=True)
    return result.getvalue()


@pytest.mark.parametrize("sample", ["ct", "mr"])
@pytest.mark.parametrize(
    "keyword,value",
    [
        ("PatientName", "TEST^IDENTIFIER"),
        ("PatientID", "MRN-987654"),
        ("PatientBirthDate", "19420214"),
        ("PatientAddress", "42 Test Street"),
        ("PatientTelephoneNumbers", "01632 960001"),
        ("OtherPatientNames", "RELATIVE^TEST"),
        ("MedicalRecordLocator", "MRN-987654"),
        ("PatientMotherBirthName", "MOTHER^TEST"),
        ("InstitutionName", "TEST HOSPITAL"),
        ("InstitutionAddress", "42 Test Road"),
        ("ReferringPhysicianName", "DOCTOR^TEST"),
        ("PerformingPhysicianName", "DOCTOR^TEST"),
        ("OperatorsName", "OPERATOR^TEST"),
        ("DeviceSerialNumber", "SERIAL-987654"),
        ("AccessionNumber", "ACC-987654"),
        ("StudyDescription", "IDENTIFIER IN FREE TEXT"),
        ("ImageComments", "IDENTIFIER IN FREE TEXT"),
        ("PatientComments", "IDENTIFIER IN FREE TEXT"),
        ("StudyDate", "20240101"),
        ("StudyTime", "120000"),
        ("PatientAge", "092Y"),
        ("ClinicalTrialSubjectID", "SUBJECT-987654"),
        ("InsurancePlanIdentification", "PLAN-987654"),
    ],
)
def test_identifier_fields_removed_from_real_origin_containers(sample, keyword, value):
    source = read(sample_dicom(sample))
    setattr(source, keyword, value)
    result = transform(encode(source))
    output = pydicom.dcmread(BytesIO(result.dicom))
    assert keyword not in output or output[keyword].is_empty
    assert output.PixelData == source.PixelData
    assert result.report["pixel_bytes_unchanged"]


@pytest.mark.parametrize("sample", ["ct", "mr"])
def test_nested_private_fields_and_uid_remap(sample):
    source = read(sample_dicom(sample))
    nested = Dataset()
    nested.PatientName = "NESTED^IDENTIFIER"
    nested.add_new((0x0011, 0x1010), "UT", "PRIVATE IDENTIFIER")
    source.RequestAttributesSequence = Sequence([nested])
    source.add_new((0x0011, 0x0010), "LO", "PRIVATE CREATOR")
    for index, vr in enumerate(["AE", "LO", "LT", "PN", "SH", "ST", "UC", "UR", "UT"], 0x1010):
        source.add_new((0x0011, index), vr, "IDENTIFIER")
    result = transform(encode(source))
    output = pydicom.dcmread(BytesIO(result.dicom))
    assert all(not e.tag.is_private and e.VR != "SQ" for e in output.iterall())
    for keyword in (
        "StudyInstanceUID",
        "SeriesInstanceUID",
        "SOPInstanceUID",
        "FrameOfReferenceUID",
    ):
        assert getattr(source, keyword) != getattr(output, keyword)
    assert "IDENTIFIER" not in output.to_json()


def test_real_origin_study_more_than_sixteen_files_with_consistent_mapping():
    ds = read(sample_dicom("ct"))
    files = []
    for index in range(20):
        ds.SOPInstanceUID = generate_uid()
        ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
        ds.InstanceNumber = index + 1
        files.append(encode(ds))
    results = transform_collection(files)
    out = [pydicom.dcmread(BytesIO(r.dicom)) for r in results]
    assert len({d.SOPInstanceUID for d in out}) == 20
    assert len({d.StudyInstanceUID for d in out}) == 1
    assert len({d.SeriesInstanceUID for d in out}) == 1
    assert len({d.FrameOfReferenceUID for d in out}) == 1


def test_nested_references_rejected_in_collection():
    ds = read(sample_dicom("ct"))
    item = Dataset()
    ref = Dataset()
    ref.ReferencedSOPClassUID = ds.SOPClassUID
    ref.ReferencedSOPInstanceUID = ds.SOPInstanceUID
    item.ReferencedImageSequence = Sequence([ref])
    ds.RequestAttributesSequence = Sequence([item])
    with pytest.raises(Unsupported, match="referenced"):
        transform_collection([encode(ds)])
