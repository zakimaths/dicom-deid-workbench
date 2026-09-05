"""Limited classic CT/MR contract, reviewed against PS3.3 2026c.

This is not the complete confidentiality profile or an independent IOD validator.
Unknown code values fail closed instead of being retained as arbitrary text.
"""

from copy import deepcopy
from pydicom.multival import MultiValue
from pydicom.datadict import dictionary_VR

CODES = {
    "PatientPosition": {
        "HFP",
        "HFS",
        "HFDR",
        "HFDL",
        "FFP",
        "FFS",
        "FFDR",
        "FFDL",
        "LFP",
        "LFS",
        "RFP",
        "RFS",
        "AFDR",
        "AFDL",
        "PFDR",
        "PFDL",
    },
    "Laterality": {"R", "L"},
    "ScanningSequence": {"SE", "IR", "GR", "EP", "RM"},
    "SequenceVariant": {"SK", "MTC", "SS", "TRSS", "SP", "MP", "OSP", "NONE"},
    "ScanOptions": {"PER", "RG", "CG", "PPG", "FC", "PFF", "PFP", "SP", "FS"},
    "MRAcquisitionType": {"2D", "3D"},
}
BASE_CODES = {"PatientPosition", "Laterality"}
MR_CODES = {"ScanningSequence", "SequenceVariant", "ScanOptions", "MRAcquisitionType"}
EMPTY_NUMERIC = {
    "SliceThickness",
    "SeriesNumber",
    "InstanceNumber",
    "AcquisitionNumber",
    "KVP",
    "EchoTime",
    "EchoTrainLength",
    "RepetitionTime",
    "InversionTime",
    "TriggerTime",
}
MR_TYPES = {
    "DENSITY MAP",
    "DIFFUSION MAP",
    "IMAGE ADDITION",
    "MODULUS SUBTRACT",
    "MPR",
    "OTHER",
    "PHASE MAP",
    "PHASE SUBTRACT",
    "PROJECTION IMAGE",
    "T1 MAP",
    "T2 MAP",
    "VELOCITY MAP",
}


def coded_keys(ds):
    return BASE_CODES | (MR_CODES if ds.Modality == "MR" else set())


def image_type(ds):
    from .core import Unsupported

    e = ds.get("ImageType")
    allowed = {"AXIAL", "LOCALIZER"} if ds.Modality == "CT" else MR_TYPES
    if (
        "ImageType" not in ds
        or ds["ImageType"].VR != "CS"
        or not isinstance(e, MultiValue)
        or len(e) < 3
        or e[2] not in allowed
    ):
        raise Unsupported("A supported image type with a known third value is required.")
    return ["DERIVED", "SECONDARY", str(e[2])]


def validate_iod_inputs(ds):
    from .core import Unsupported

    image_type(ds)
    for key in (
        "FrameOfReferenceUID",
        "ImagePositionPatient",
        "ImageOrientationPatient",
        "PixelSpacing",
    ):
        if key not in ds or ds[key].is_empty:
            raise Unsupported("A required image geometry or frame reference field is missing.")
    if not ds.FrameOfReferenceUID.is_valid:
        raise Unsupported("A frame reference identifier is invalid.")
    for key in coded_keys(ds):
        if key not in ds or ds[key].is_empty:
            if key in {"ScanningSequence", "SequenceVariant"}:
                raise Unsupported("Required MR sequence information is missing.")
            continue
        e = ds[key]
        values = list(e.value) if isinstance(e.value, MultiValue) else [str(e.value)]
        multi = key in {"ScanningSequence", "SequenceVariant", "ScanOptions"}
        if (
            e.VR != dictionary_VR(e.tag)
            or (not multi and e.VM != 1)
            or not set(values) <= CODES[key]
        ):
            raise Unsupported("An acquisition code is unknown or has an invalid representation.")
        if key == "SequenceVariant" and "NONE" in values and len(values) > 1:
            raise Unsupported("MR sequence variant NONE cannot be combined with another variant.")
        if key == "ScanningSequence" and {"SE", "GR"} <= set(values):
            raise Unsupported("This MR scanning-sequence combination is unsupported.")


def complete_iod(output, source):
    for key in coded_keys(source):
        if key in source:
            output.add(deepcopy(source[key]))
        else:
            setattr(output, key, "")
    output.PositionReferenceIndicator = ""
    required = {"SliceThickness", "SeriesNumber", "InstanceNumber"}
    if source.Modality == "CT":
        required |= {"KVP", "AcquisitionNumber"}
    else:
        required |= {"EchoTime", "EchoTrainLength", "RepetitionTime"}
        seq = source.ScanningSequence
        if "IR" in seq:
            required.add("InversionTime")
        if any(code in source.get("ScanOptions", []) for code in ("CG", "PPG")):
            required.add("TriggerTime")
    for key in required:
        if key not in output:
            setattr(output, key, None)
    output.ImageType = image_type(source)
