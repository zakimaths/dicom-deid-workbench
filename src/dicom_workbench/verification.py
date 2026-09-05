"""Post-write checks of the custom metadata contract, not IOD or privacy certification."""

from pydicom.datadict import dictionary_VR
from pydicom.uid import ExplicitVRLittleEndian
from .iod import EMPTY_NUMERIC, coded_keys, image_type, validate_iod_inputs

NUMERIC_VRS = {"DS", "IS", "US", "SS", "UL", "SL", "FL", "FD"}


def verify_metadata(output, source):
    from .core import (
        EMPTY_FIELDS,
        IMPLEMENTATION_UID,
        IMPLEMENTATION_VERSION,
        KEEP_NUMERIC,
        UID_FIELDS,
        Unsupported,
    )

    allowed = (
        KEEP_NUMERIC
        | coded_keys(source)
        | {"PositionReferenceIndicator"}
        | set(EMPTY_FIELDS)
        | set(UID_FIELDS)
        | {
            "PixelData",
            "SOPClassUID",
            "Modality",
            "PhotometricInterpretation",
            "ImageType",
            "DerivationDescription",
            "DeidentificationMethod",
            "RescaleType",
        }
    )
    required = {key for key in KEEP_NUMERIC | set(UID_FIELDS) if key in source}
    required |= (
        set(EMPTY_FIELDS)
        | set(UID_FIELDS[:3])
        | {
            "PixelData",
            "SOPClassUID",
            "Modality",
            "PhotometricInterpretation",
            "ImageType",
            "DerivationDescription",
            "DeidentificationMethod",
        }
    )
    required |= coded_keys(source) | {"PositionReferenceIndicator"}
    required |= {"SliceThickness", "SeriesNumber", "InstanceNumber"}
    if source.Modality == "MR":
        required |= {"EchoTime", "EchoTrainLength", "RepetitionTime"}
        if "IR" in source.ScanningSequence:
            required.add("InversionTime")
        if any(code in source.get("ScanOptions", []) for code in ("CG", "PPG")):
            required.add("TriggerTime")
    else:
        required |= {"KVP", "AcquisitionNumber"}
    if source.Modality == "CT":
        required.add("RescaleType")
    if any(key not in output for key in required):
        raise Unsupported("Metadata verification failed: a required output field is missing.")
    for element in output:
        if element.tag.is_private or element.VR == "SQ" or element.keyword not in allowed:
            raise Unsupported("Metadata verification failed: unexpected output field.")
        expected_vr = "OW" if element.keyword == "PixelData" else dictionary_VR(element.tag)
        if element.VR != expected_vr:
            raise Unsupported("Metadata verification failed: invalid field representation.")
        if element.keyword in KEEP_NUMERIC:
            if element.VR not in NUMERIC_VRS or element.VR != dictionary_VR(element.tag):
                raise Unsupported("Metadata verification failed: invalid numeric representation.")
            if (
                element.keyword in EMPTY_NUMERIC
                and element.is_empty
                and (element.tag not in source or source[element.tag].is_empty)
            ):
                continue
            if element.tag not in source or element != source[element.tag]:
                raise Unsupported("Metadata verification failed: an imaging field changed.")
    validate_iod_inputs(output)
    for key in coded_keys(source):
        if key in source and output[key] != source[key]:
            raise Unsupported("Metadata verification failed: an acquisition code changed.")
    if output.PositionReferenceIndicator not in (None, ""):
        raise Unsupported("Metadata verification failed: position reference is not empty.")
    for key in EMPTY_FIELDS:
        if key not in output or output[key].value not in ("", None):
            raise Unsupported("Metadata verification failed: an identity placeholder is not empty.")
    if (
        list(output.ImageType) != image_type(source)
        or output.DeidentificationMethod != "single-frame-metadata-v2; no PS3.15 conformance claim"
    ):
        raise Unsupported("Metadata verification failed: unexpected method description.")
    if output.DerivationDescription not in (
        "Experimental metadata scrub; pixels unchanged and not assessed.",
        "Selected pixel rectangles erased; remaining pixels and anatomy not assessed.",
    ):
        raise Unsupported("Metadata verification failed: unexpected derivation description.")
    for key in ("SOPClassUID", "Modality", "PhotometricInterpretation"):
        if output.get(key) != source.get(key):
            raise Unsupported("Metadata verification failed: image interpretation changed.")
    if "RescaleType" in output and output.RescaleType != "HU":
        raise Unsupported("Metadata verification failed: unexpected rescale units.")
    originals = {str(source.get(key, "")) for key in UID_FIELDS}
    for key in UID_FIELDS:
        if key in source or key in UID_FIELDS[:3]:
            if (
                key not in output
                or not output[key].value.is_valid
                or str(output[key].value) in originals
            ):
                raise Unsupported("Metadata verification failed: an identifier was not replaced.")
    if output.preamble != b"\0" * 128:
        raise Unsupported("Metadata verification failed: the preamble is not clear.")
    allowed_meta = {
        "FileMetaInformationGroupLength",
        "FileMetaInformationVersion",
        "MediaStorageSOPClassUID",
        "MediaStorageSOPInstanceUID",
        "TransferSyntaxUID",
        "ImplementationClassUID",
        "ImplementationVersionName",
    }
    if any(e.keyword not in allowed_meta for e in output.file_meta):
        raise Unsupported("Metadata verification failed: unexpected file metadata.")
    expected_meta = {
        "FileMetaInformationVersion": b"\x00\x01",
        "MediaStorageSOPClassUID": output.SOPClassUID,
        "MediaStorageSOPInstanceUID": output.SOPInstanceUID,
        "TransferSyntaxUID": ExplicitVRLittleEndian,
        "ImplementationClassUID": IMPLEMENTATION_UID,
        "ImplementationVersionName": IMPLEMENTATION_VERSION,
    }
    for key, value in expected_meta.items():
        if output.file_meta.get(key) != value or output.file_meta[key].VR != dictionary_VR(
            output.file_meta[key].tag
        ):
            raise Unsupported(
                "Metadata verification failed: file metadata disagrees with the contract."
            )
    return {
        "custom_metadata_contract": "passed",
        "private_and_sequence_fields": "absent",
        "identity_placeholders": "empty",
        "source_uids": "replaced",
        "iod_validation": "not_performed",
        "complete_anonymity": "not_established",
    }
