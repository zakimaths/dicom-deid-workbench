"""A deliberately narrow allowlist policy. Pixel identity is never assessed here."""

from dataclasses import dataclass
from io import BytesIO
from hashlib import sha256
import math
import warnings

import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.multival import MultiValue
from pydicom.datadict import dictionary_VR, dictionary_VM

from .redaction import replace_pixels, verify_pixels
from .structure import preflight
from .verification import NUMERIC_VRS, verify_metadata
from pydicom.uid import CTImageStorage, MRImageStorage, ExplicitVRLittleEndian, generate_uid

POLICY = "single-frame-metadata-v1"
MAX_BYTES = 8 * 1024 * 1024
MAX_DIMENSION = 1024
IMPLEMENTATION_VERSION = "DEID_WB_021"
IMPLEMENTATION_UID = "2.25.188025864089722936239435475126635725439"
DISCLAIMER = (
    "Metadata only. Pixels and recognisable anatomy have not been assessed. Not for clinical use."
)

# Retained numeric imaging fields only. Text, dates, private data and all sequences are dropped.
# This is intentionally not a complete implementation of DICOM PS3.15 or every CT/MR IOD.
KEEP_NUMERIC = frozenset(
    {
        "SamplesPerPixel",
        "Rows",
        "Columns",
        "BitsAllocated",
        "BitsStored",
        "HighBit",
        "PixelRepresentation",
        "PixelSpacing",
        "ImagePositionPatient",
        "ImageOrientationPatient",
        "SliceThickness",
        "SpacingBetweenSlices",
        "SliceLocation",
        "SeriesNumber",
        "InstanceNumber",
        "RescaleIntercept",
        "RescaleSlope",
        "WindowCenter",
        "WindowWidth",
        "KVP",
        "RepetitionTime",
        "EchoTime",
        "InversionTime",
        "NumberOfAverages",
        "ImagingFrequency",
        "MagneticFieldStrength",
        "EchoTrainLength",
        "PercentSampling",
        "PercentPhaseFieldOfView",
        "PixelBandwidth",
        "FlipAngle",
        "SAR",
        "AcquisitionMatrix",
        "ReconstructionDiameter",
        "DistanceSourceToDetector",
        "DistanceSourceToPatient",
        "GantryDetectorTilt",
        "TableHeight",
        "RotationDirection",
        "ExposureTime",
        "XRayTubeCurrent",
        "Exposure",
    }
) - {"RotationDirection"}
EMPTY_FIELDS = (
    "PatientName",
    "PatientID",
    "PatientBirthDate",
    "PatientSex",
    "StudyDate",
    "StudyTime",
    "AccessionNumber",
    "ReferringPhysicianName",
    "StudyID",
    "Manufacturer",
)
UID_FIELDS = ("SOPInstanceUID", "StudyInstanceUID", "SeriesInstanceUID", "FrameOfReferenceUID")
REJECT_FIELDS = (
    "ModalityLUTSequence",
    "VOILUTSequence",
    "PresentationLUTSequence",
    "PixelPaddingValue",
    "PixelPaddingRangeLimit",
    "PixelAspectRatio",
)


class Unsupported(ValueError):
    """Safe, fixed error text suitable for display without leaking source metadata."""


@dataclass
class Result:
    dicom: bytes
    pixels: bytes
    image: dict
    report: dict


def read(data: bytes) -> FileDataset:
    if len(data) > MAX_BYTES:
        raise Unsupported("This version accepts files up to 8 MiB.")
    if len(data) < 132 or data[128:132] != b"DICM":
        raise Unsupported("Choose a DICOM Part 10 file with a DICM header.")
    try:
        preflight(data)
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            ds = pydicom.dcmread(BytesIO(data))
            # Trigger lazy conversion while warnings/errors are still contained.
            count = 0

            def visit(item, depth=0):
                nonlocal count
                if depth > 8:
                    raise Unsupported("Nested metadata exceeds the supported depth.")
                for element in item:
                    count += 1
                    if count > 10000:
                        raise Unsupported("The file contains too many metadata elements.")
                    if element.VR == "SQ":
                        for child in element.value:
                            visit(child, depth + 1)

            visit(ds)
            validate(ds)
        return ds
    except Unsupported:
        raise
    except Exception:
        raise Unsupported("The file is malformed or uses unsupported metadata encoding.") from None


def first(value):
    return value[0] if isinstance(value, (list, tuple, MultiValue)) else value


def number(value):
    try:
        result = float(value)
        if not math.isfinite(result) or abs(result) > 1e12:
            raise ValueError
        return result
    except (TypeError, ValueError, OverflowError):
        raise Unsupported("An imaging field contains an unsupported numeric value.") from None


def validate(ds):
    # Validate shapes before interpreting values: a list containing YES must never
    # slip past a scalar equality check. Only the declared input envelope is accepted.
    controls = (
        *UID_FIELDS,
        "SOPClassUID",
        "Modality",
        "PhotometricInterpretation",
        "NumberOfFrames",
        "VOILUTFunction",
        "PresentationLUTShape",
        "BurnedInAnnotation",
        "RecognizableVisualFeatures",
        "RescaleType",
    )
    for key in controls:
        if key in ds:
            element = ds[key]
            if element.VR != dictionary_VR(element.tag) or element.VM != 1:
                raise Unsupported(
                    "An image control field has an unsupported representation or number of values."
                )
    for key in ("BurnedInAnnotation", "RecognizableVisualFeatures"):
        if key in ds and ds.get(key) not in ("YES", "NO"):
            raise Unsupported("An image identity declaration has an unsupported value.")
    for key in KEEP_NUMERIC:
        if key in ds:
            element = ds[key]
            if element.VR not in NUMERIC_VRS or element.VR != dictionary_VR(element.tag):
                raise Unsupported("An imaging field has an unsupported value representation.")
            vm = dictionary_VM(element.tag)
            if not (element.VM >= 1 if vm == "1-n" else str(element.VM) == vm):
                raise Unsupported("An imaging field has an unsupported number of values.")
            values = element.value
            for value in values if isinstance(values, (list, MultiValue)) else [values]:
                number(value)
    if "PixelData" not in ds or ds["PixelData"].VR != "OW":
        raise Unsupported("This version requires 16-bit word pixel data.")
    if str(ds.file_meta.get("TransferSyntaxUID", "")) != str(ExplicitVRLittleEndian):
        raise Unsupported("Only uncompressed Explicit VR Little Endian files are supported.")
    sop = str(ds.get("SOPClassUID", ""))
    if sop not in (str(CTImageStorage), str(MRImageStorage)):
        raise Unsupported("Only classic CT and MR Image Storage files are supported.")
    if str(ds.file_meta.get("MediaStorageSOPClassUID", "")) != sop:
        raise Unsupported("The file and dataset disagree about the image type.")
    if str(ds.file_meta.get("MediaStorageSOPInstanceUID", "")) != str(ds.get("SOPInstanceUID", "")):
        raise Unsupported("The file and dataset disagree about the image identifier.")
    for key in UID_FIELDS[:3]:
        if key not in ds or not ds[key].value or not pydicom.uid.UID(str(ds[key].value)).is_valid:
            raise Unsupported("The file is missing a valid study, series or image identifier.")
    if ds.get("Modality") != ("CT" if sop == str(CTImageStorage) else "MR"):
        raise Unsupported("The modality does not match the image type.")
    if int(ds.get("NumberOfFrames", 1)) != 1:
        raise Unsupported("Multiframe files are not supported. Choose a single-frame CT or MR.")
    if ds.get("PhotometricInterpretation") not in ("MONOCHROME1", "MONOCHROME2"):
        raise Unsupported("Only monochrome images are supported.")
    if (
        ds.get("SamplesPerPixel"),
        ds.get("BitsAllocated"),
        ds.get("BitsStored"),
        ds.get("HighBit"),
    ) != (1, 16, 16, 15) or ds.get("PixelRepresentation") not in (0, 1):
        raise Unsupported("This version requires one channel with 16 allocated and stored bits.")
    rows, cols = int(ds.get("Rows", 0)), int(ds.get("Columns", 0))
    if not (1 <= rows <= MAX_DIMENSION and 1 <= cols <= MAX_DIMENSION):
        raise Unsupported("Image dimensions must be between 1 and 1024 pixels.")
    if len(ds.get("PixelData", b"")) != rows * cols * 2:
        raise Unsupported("The pixel data length does not match the image dimensions.")
    if any(key in ds for key in REJECT_FIELDS):
        raise Unsupported("LUT, padding or pixel-aspect-ratio features are not supported yet.")
    if ds.get("VOILUTFunction", "LINEAR") != "LINEAR":
        raise Unsupported("Only the standard LINEAR window function is supported.")
    if ds.get("PresentationLUTShape", "IDENTITY") != "IDENTITY":
        raise Unsupported("A separate presentation LUT is not supported.")
    if (
        ds.get("BurnedInAnnotation", "") == "YES"
        or ds.get("RecognizableVisualFeatures", "") == "YES"
    ):
        raise Unsupported(
            "The file declares identifying pixels or recognisable features. Pixel cleaning is not supported."
        )
    if ds.Modality == "CT" and not all(k in ds for k in ("RescaleSlope", "RescaleIntercept")):
        raise Unsupported("CT files must provide rescale slope and intercept.")
    if ("RescaleSlope" in ds) != ("RescaleIntercept" in ds):
        raise Unsupported("Rescale slope and intercept must be provided together.")
    if number(ds.get("RescaleSlope", 1)) == 0:
        raise Unsupported("Rescale slope must not be zero.")
    if "PixelSpacing" in ds:
        if len(ds.PixelSpacing) != 2 or not all(0.01 <= number(x) <= 100 for x in ds.PixelSpacing):
            raise Unsupported("Pixel spacing is outside the supported range.")
    if ("WindowCenter" in ds) != ("WindowWidth" in ds):
        raise Unsupported("Window center and width must be provided together.")
    if "WindowWidth" in ds:
        if ds["WindowCenter"].VM != ds["WindowWidth"].VM:
            raise Unsupported("Window centers and widths must have matching numbers of values.")
        widths = ds.WindowWidth if ds["WindowWidth"].VM > 1 else [ds.WindowWidth]
        if any(number(width) < 1 for width in widths):
            raise Unsupported("Every window width must be at least one.")


def transform(data: bytes, regions=None) -> Result:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            return _transform(data, regions)
    except Unsupported:
        raise
    except Exception:
        raise Unsupported(
            "Output could not be verified for this file. Try the synthetic example."
        ) from None


def _transform(data: bytes, regions=None) -> Result:
    source = read(data)
    output = FileDataset(None, {}, file_meta=FileMetaDataset(), preamble=b"\0" * 128)
    actions = []
    # Dropping a sequence drops its entire tree, including identifiers in its items.
    for element in source:
        if element.keyword in KEEP_NUMERIC or element.keyword in (
            "PixelData",
            "SOPClassUID",
            "Modality",
            "PhotometricInterpretation",
        ):
            output.add(element)
            action = (
                "replaced" if element.keyword == "PixelData" and regions is not None else "kept"
            )
        elif element.keyword in EMPTY_FIELDS:
            action = "emptied"
        elif element.keyword in (
            *UID_FIELDS,
            "ImageType",
            "DerivationDescription",
            "DeidentificationMethod",
        ) or (element.keyword == "RescaleType" and source.Modality == "CT"):
            action = "replaced"
        else:
            action = "removed"
        actions.append(
            {
                "tag": f"({element.tag.group:04X},{element.tag.element:04X})",
                "field": "Private field" if element.tag.is_private else element.name,
                "action": action,
            }
        )
    for key in EMPTY_FIELDS:
        setattr(output, key, "")
    # One-file scope: no cross-file continuity is promised; all source references are dropped.
    uid_map = {}
    for key in UID_FIELDS:
        if key in source or key != "FrameOfReferenceUID":
            old = str(source.get(key, ""))
            uid_map.setdefault(old, generate_uid())
            setattr(output, key, uid_map[old])
    output.ImageType = ["DERIVED", "SECONDARY"]
    output.DerivationDescription = "Experimental metadata scrub; pixels unchanged and not assessed."
    output.DeidentificationMethod = "single-frame-metadata-v1; no PS3.15 conformance claim"
    if source.Modality == "CT":
        # Do not retain arbitrary source text in RescaleType.
        if source.get("RescaleType", "HU") != "HU":
            raise Unsupported("Only CT rescale values declared as HU are supported.")
        output.RescaleType = "HU"
    boxes, fill = [], None
    if regions is not None:
        redacted, boxes, fill = replace_pixels(source, regions)
        # Replace the element rather than mutate the element shared with source.
        output.add_new(0x7FE00010, "OW", redacted)
        output.DerivationDescription = (
            "Selected pixel rectangles erased; remaining pixels and anatomy not assessed."
        )
    output.file_meta.MediaStorageSOPClassUID = output.SOPClassUID
    output.file_meta.MediaStorageSOPInstanceUID = output.SOPInstanceUID
    output.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    output.file_meta.ImplementationClassUID = IMPLEMENTATION_UID
    output.file_meta.ImplementationVersionName = IMPLEMENTATION_VERSION
    buffer = BytesIO()
    pydicom.dcmwrite(buffer, output, enforce_file_format=True)
    encoded = buffer.getvalue()
    checked = read(encoded)
    metadata_checks = verify_metadata(checked, source)
    selected = changed = 0
    if boxes:
        selected, changed = verify_pixels(
            source.PixelData,
            checked.PixelData,
            source.Rows,
            source.Columns,
            boxes,
            fill,
            bool(source.PixelRepresentation),
        )
    elif checked.PixelData != source.PixelData:
        raise Unsupported("Output verification failed: pixel data changed.")
    spacing = [float(x) for x in checked.get("PixelSpacing", [1, 1])]
    image = {
        "rows": checked.Rows,
        "columns": checked.Columns,
        "signed": checked.PixelRepresentation == 1,
        "invert": checked.PhotometricInterpretation == "MONOCHROME1",
        "slope": float(checked.get("RescaleSlope", 1)),
        "intercept": float(checked.get("RescaleIntercept", 0)),
        "center": float(first(checked.WindowCenter)) if "WindowCenter" in checked else None,
        "width": float(first(checked.WindowWidth)) if "WindowWidth" in checked else None,
        "spacing": spacing,
        "modality": checked.Modality,
    }
    report = {
        "report_schema": 2,
        "output_sha256": sha256(encoded).hexdigest(),
        "pixel_policy": "stored-rectangles-v1" if boxes else "preserve-v1",
        "policy": POLICY,
        "scope": "Single-file metadata subset; not PS3.15 conformant",
        "pixel_review": "selected_regions_only" if boxes else "not_assessed",
        "verification": metadata_checks,
        "redaction": {
            "regions": boxes,
            "fill_stored_value": fill,
            "selected_pixels": selected,
            "changed_pixels": changed,
            "outside_regions_unchanged": True,
            "all_identifiers_removed": "not_established",
        },
        "notice": "Selected regions erased. Remaining pixels and anatomy are not assessed. Not for clinical use."
        if boxes
        else DISCLAIMER,
        "pixel_bytes_unchanged": checked.PixelData == source.PixelData,
        "output_reopened": True,
        "file_metadata": "rebuilt",
        "preamble": "zeroed",
        "counts": {
            a: sum(x["action"] == a for x in actions)
            for a in ("removed", "emptied", "replaced", "kept")
        },
        "actions": actions,
    }
    return Result(encoded, checked.PixelData, image, report)
