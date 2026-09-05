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
        "source": "pydicom / NEMA",
        "remove": "PixelPaddingValue",
        "sha256": "3dd31e5cc835b3f2cdd46c9da1982f59251e78518fefa8163d914631c66437d6",
        "preparation": "Removed an unused padding marker; no pixels have that value. Pixels unchanged.",
    },
    "mr": {
        "file": "MR_small.dcm",
        "title": "Public MRI teaching slice",
        "source": "pydicom / NEMA",
        "remove": "EchoTrainLength",
        "sha256": "3f27d1c22f1a66e80d7bb7c911e8610fd0bb70325a76746a7adb1c0ddefcf2bb",
        "preparation": "Removed an empty Echo Train Length field. Pixels unchanged.",
    },
    "ct-a": {
        "file": "dicomdirtests/77654033/CT2/17106",
        "title": "CT test slice A · 16 × 16",
        "source": "pydicom / PCIR",
        "sha256": "678df720411e86df67031c28e16192cd31e2062a3f090d657b9f16ce86db3f1d",
        "remove": "PixelPaddingValue",
        "preparation": "Tiny test fixture. Removed an unused padding marker; no pixels have that value. Pixels unchanged.",
    },
    "ct-b": {
        "file": "dicomdirtests/98892001/CT2N/6293",
        "title": "CT test slice B · 16 × 16",
        "source": "pydicom / PCIR",
        "sha256": "de2970da0589ca948fba863bf0e93f4c18a1695bd3ec2fe8fa73905b53ac5e67",
        "remove": "ReconstructionDiameter",
        "preparation": "Tiny test fixture. Removed an empty Reconstruction Diameter field. Pixels unchanged.",
    },
    "mr-a": {
        "file": "dicomdirtests/98892003/MR1/4919",
        "title": "MRI test slice A · 16 × 16",
        "source": "pydicom / PCIR",
        "sha256": "1a0fc2ec617623aeeccf4492bc605ace4efb33cebce7fe4dd54bce472b1c8635",
        "remove": None,
        "preparation": "Tiny test fixture. No preparation needed. Pixels unchanged.",
    },
    "mr-b": {
        "file": "dicomdirtests/98892003/MR1/5641",
        "title": "MRI test slice B · 16 × 16",
        "source": "pydicom / PCIR",
        "sha256": "fb809e867ae98a1c995d41f0d458fb7aa2cf117b8b7331559bd0134653c984e8",
        "remove": None,
        "preparation": "Tiny test fixture. No preparation needed. Pixels unchanged.",
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
    if sample["remove"] == "PixelPaddingValue":
        padding = int(ds.PixelPaddingValue).to_bytes(2, "little", signed=True)
        if any(ds.PixelData[i : i + 2] == padding for i in range(0, len(ds.PixelData), 2)):
            raise Unsupported("The teaching scan contains unsupported padding pixels.")
        del ds.PixelPaddingValue
    elif sample["remove"]:
        if not ds[sample["remove"]].is_empty:
            raise Unsupported("The teaching scan has unexpected metadata.")
        del ds[sample["remove"]]
    output = BytesIO()
    pydicom.dcmwrite(output, ds, enforce_file_format=True)
    return output.getvalue()
