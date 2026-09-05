"""Pinned public teaching slices shipped with pydicom; never download at runtime."""

from hashlib import sha256
from io import BytesIO
from pathlib import Path

import pydicom

from .core import Unsupported

SAMPLES = {
    "ct": {
        "file": "CT_small.dcm",
        "title": "Public CT teaching slice",
        "sha256": "3dd31e5cc835b3f2cdd46c9da1982f59251e78518fefa8163d914631c66437d6",
        "preparation": "Removed an unused padding marker; no pixels have that value. Pixels unchanged.",
    },
    "mr": {
        "file": "MR_small.dcm",
        "title": "Public MRI teaching slice",
        "sha256": "3f27d1c22f1a66e80d7bb7c911e8610fd0bb70325a76746a7adb1c0ddefcf2bb",
        "preparation": "Removed an empty Echo Train Length field. Pixels unchanged.",
    },
}


def sample_dicom(key):
    if key not in SAMPLES:
        raise Unsupported("Choose one of the listed public samples.")
    sample = SAMPLES[key]
    path = Path(pydicom.__file__).parent / "data" / "test_files" / sample["file"]
    try:
        raw = path.read_bytes()
    except OSError:
        raise Unsupported(
            "The teaching scans are missing. Reinstall the locked dependencies."
        ) from None
    if sha256(raw).hexdigest() != sample["sha256"]:
        raise Unsupported(
            "The teaching scan does not match the checked version. Reinstall dependencies."
        )
    ds = pydicom.dcmread(BytesIO(raw))
    # Adapt only these known files, never arbitrary uploads or the core validation rules.
    if key == "ct":
        padding = int(ds.PixelPaddingValue).to_bytes(2, "little", signed=True)
        if any(ds.PixelData[i : i + 2] == padding for i in range(0, len(ds.PixelData), 2)):
            raise Unsupported("The teaching scan contains unsupported padding pixels.")
        del ds.PixelPaddingValue
    else:
        if not ds["EchoTrainLength"].is_empty:
            raise Unsupported("The teaching scan has unexpected metadata.")
        del ds.EchoTrainLength
    output = BytesIO()
    pydicom.dcmwrite(output, ds, enforce_file_format=True)
    return output.getvalue()
