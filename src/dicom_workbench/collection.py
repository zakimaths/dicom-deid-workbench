"""Bounded, in-memory single-study mapping. No mapping is persisted or returned."""

from .core import read, transform, Unsupported, MAX_BYTES


def transform_collection(files):
    if not isinstance(files, (list, tuple)) or not 1 <= len(files) <= 16:
        raise Unsupported("Choose between 1 and 16 supported files from one study.")
    if any(not isinstance(data, bytes) or len(data) > MAX_BYTES for data in files):
        raise Unsupported("Collection files must each be at most 8 MiB.")
    datasets = [read(data) for data in files]
    if len({str(ds.StudyInstanceUID) for ds in datasets}) != 1:
        raise Unsupported("Mixed studies are not supported in one collection.")
    if len({str(ds.SOPInstanceUID) for ds in datasets}) != len(files):
        raise Unsupported("Duplicate image identifiers are not supported.")
    # Do not imply reference preservation: this policy still drops sequence trees.
    if any(any(e.VR == "SQ" and e.keyword.startswith("Referenced") for e in ds) for ds in datasets):
        raise Unsupported("Collections with referenced-object sequences are not supported.")
    # Same series must not disagree about modality or coordinate frame.
    series = {}
    for ds in datasets:
        value = (str(ds.Modality), str(ds.FrameOfReferenceUID))
        key = str(ds.SeriesInstanceUID)
        if key in series and series[key] != value:
            raise Unsupported("Files in a series disagree about modality or coordinate frame.")
        series[key] = value
    context = {}
    results = [transform(data, _uid_context=context) for data in files]
    for result in results:
        result.report["collection"] = {
            "files": len(files),
            "uid_scope": "single_study",
            "reference_sequences": "unsupported",
            "date_policy": "empty",
        }
    return results
