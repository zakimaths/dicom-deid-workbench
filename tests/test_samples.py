from hashlib import sha256
from io import BytesIO
from pathlib import Path

import pydicom
import pytest

from dicom_workbench.core import Unsupported, transform
from dicom_workbench.samples import SAMPLES, sample_dicom


@pytest.mark.parametrize("key", SAMPLES)
def test_public_samples_reproducible_pixels_and_preparation(key):
    spec = SAMPLES[key]
    raw = (Path(pydicom.__file__).parent / "data/test_files" / spec["file"]).read_bytes()
    assert sha256(raw).hexdigest() == spec["sha256"]
    original = pydicom.dcmread(BytesIO(raw))
    prepared = sample_dicom(key)
    assert prepared == sample_dicom(key)
    ds = pydicom.dcmread(BytesIO(prepared))
    removed = spec["remove"]
    if removed:
        assert removed not in ds and removed in original
    assert len(ds) == len(original) - int(removed is not None)
    for element in ds:
        assert element == original[element.tag]
    result = transform(prepared)
    output = pydicom.dcmread(BytesIO(result.dicom))
    assert output.PixelData == original.PixelData == result.pixels
    assert not output.PatientName and not output.PatientID
    assert result.report["pixel_bytes_unchanged"]


def test_samples_reject_unknown_key_and_changed_source(monkeypatch):
    with pytest.raises(Unsupported):
        sample_dicom("../../secret")
    monkeypatch.setitem(SAMPLES["ct"], "sha256", "wrong")
    with pytest.raises(Unsupported, match="checked version"):
        sample_dicom("ct")
