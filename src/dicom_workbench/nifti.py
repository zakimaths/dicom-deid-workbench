"""Bounded NIfTI-1 scalar-3D inspection and header-only reconstruction.

No face removal or BIDS claim. Source bytes never enter reports or disk caches.
"""

from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import struct
import zlib

import nibabel as nib
import numpy as np

from .core import Unsupported

MAX_INPUT = 32 * 1024 * 1024
MAX_DECODED = 64 * 1024 * 1024
MAX_VOXELS = 256**3
MAX_OFFSET = 1024 * 1024
POLICY = "nifti1-scalar3d-header-v1"
TYPES = {2: 8, 4: 16, 512: 16, 16: 32}
TEXT = {"descrip": (148, 228), "aux_file": (228, 252), "intent_name": (328, 344)}
# Preserve defined interpretation fields, not unused ANALYZE bytes, intent parameters,
# free text, extension payloads or arbitrary pre/post-image padding.
KEEP = ((39, 56), (70, 74), (74, 108), (112, 140), (252, 328))


@dataclass
class NiftiResult:
    data: bytes
    summary: dict
    report: dict


def decode(raw: bytes) -> bytes:
    if not 0 < len(raw) <= MAX_INPUT:
        raise Unsupported("Choose a NIfTI file up to 32 MiB.")
    if raw[:2] != b"\x1f\x8b":
        return raw
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    try:
        data = decoder.decompress(raw, MAX_DECODED + 1)
    except zlib.error:
        raise Unsupported("The compressed file is damaged.") from None
    if len(data) > MAX_DECODED or decoder.unconsumed_tail:
        raise Unsupported("The unpacked volume exceeds the 64 MiB limit.")
    if not decoder.eof or decoder.unused_data:
        raise Unsupported("Use one complete gzip stream without appended data.")
    return data


def inspect(raw: bytes) -> NiftiResult:
    try:
        return _inspect(raw)
    except Unsupported:
        raise
    except Exception:
        raise Unsupported("This volume could not be verified. No export was created.") from None


def _inspect(raw):
    return _inspect_decoded(decode(raw))


def _inspect_decoded(data):
    if len(data) < 352 or len(data) > MAX_DECODED:
        raise Unsupported("The volume is incomplete or exceeds the unpacked limit.")
    endian = "<" if struct.unpack_from("<i", data)[0] == 348 else ">"
    if struct.unpack_from(endian + "i", data)[0] != 348 or data[344:348] != b"n+1\0":
        raise Unsupported("Use single-file NIfTI-1 (.nii or .nii.gz), not NIfTI-2 or paired files.")
    header = nib.Nifti1Header.from_fileobj(BytesIO(data[:348]), check=False)
    dims = tuple(int(v) for v in header["dim"])
    if dims[0] != 3 or any(v < 1 or v > 512 for v in dims[1:4]) or dims[4:] != (1, 1, 1, 1):
        raise Unsupported("This version opens scalar 3D volumes only, with dimensions up to 512.")
    count = int(np.prod(dims[1:4], dtype=np.int64))
    if count > MAX_VOXELS:
        raise Unsupported("This volume exceeds the 16,777,216 voxel limit.")
    code, bits = int(header["datatype"]), int(header["bitpix"])
    if TYPES.get(code) != bits:
        raise Unsupported("Use uint8, int16, uint16 or float32 voxel values.")
    if int(header["intent_code"]) != 0:
        raise Unsupported("Specialised image intents are not supported in this first version.")
    offset = float(header["vox_offset"])
    if (
        not np.isfinite(offset)
        or not offset.is_integer()
        or not 352 <= offset <= MAX_OFFSET
        or offset % 16
    ):
        raise Unsupported("The image-data offset is invalid or unsupported.")
    offset = int(offset)
    size = count * bits // 8
    if offset + size > len(data):
        raise Unsupported("The voxel data is incomplete.")
    spacing = np.array(header["pixdim"][1:4], dtype=float)
    if not np.all(np.isfinite(spacing)) or np.any(spacing <= 0):
        raise Unsupported("The voxel spacing must be finite and positive.")
    units = int(header["xyzt_units"])
    if units & 7 != 2 or units & 56 not in (0, 8, 16, 24):
        raise Unsupported(
            "This viewer currently requires millimetre spatial units and recognised time units."
        )
    qcode, scode = int(header["qform_code"]), int(header["sform_code"])
    if qcode not in range(6) or scode not in range(6) or not (qcode or scode):
        raise Unsupported("A supported, coded orientation is required; it will not be guessed.")
    forms = []
    for code_, matrix in ((qcode, header.get_qform()), (scode, header.get_sform())):
        if code_:
            if not np.isfinite(matrix).all() or abs(np.linalg.det(matrix[:3, :3])) < 1e-10:
                raise Unsupported("A coordinate transform is invalid.")
            forms.append(matrix)
    if len(forms) == 2 and np.sign(np.linalg.det(forms[0][:3, :3])) != np.sign(
        np.linalg.det(forms[1][:3, :3])
    ):
        raise Unsupported("The two orientations disagree about left and right. Review the source.")
    slope, intercept = header.get_slope_inter()
    slope, intercept = (1.0, 0.0) if slope is None else (float(slope), float(intercept))
    if not np.isfinite([slope, intercept]).all():
        raise Unsupported("The intensity scaling is invalid.")
    payload = data[offset : offset + size]
    values = np.frombuffer(payload, dtype=header.get_data_dtype())
    if not np.isfinite(values).all():
        raise Unsupported("Volumes with non-finite voxel values are not supported yet.")
    low, high = float(values.min()) * slope + intercept, float(values.max()) * slope + intercept
    if not np.isfinite([low, high]).all() or max(abs(low), abs(high)) > np.finfo(np.float32).max:
        raise Unsupported("The scaled intensity range cannot be displayed safely.")
    extensions = 0
    if data[348]:
        pos = 352
        while pos < offset:
            if pos + 8 > offset:
                raise Unsupported("The extension header is incomplete.")
            length, _ = struct.unpack_from(endian + "ii", data, pos)
            if length < 16 or length % 16 or pos + length > offset:
                raise Unsupported("An extension length is invalid.")
            extensions += 1
            pos += length
    clean = bytearray(352)
    struct.pack_into(endian + "i", clean, 0, 348)
    for start, end in KEEP:
        clean[start:end] = data[start:end]
    struct.pack_into(endian + "f", clean, 108, 352)
    clean[344:348] = b"n+1\0"
    output = bytes(clean) + payload
    # Independent library re-open of the actual serialised output, not viewer state.
    reopened = nib.Nifti1Image.from_bytes(output)
    if reopened.dataobj.get_unscaled().tobytes(order="F") != payload:
        raise Unsupported("Saved voxel values did not match; export blocked.")
    after = reopened.header
    for field in ("dim", "pixdim", "datatype", "bitpix", "xyzt_units", "qform_code", "sform_code"):
        if not np.array_equal(header[field], after[field], equal_nan=True):
            raise Unsupported("Saved geometry did not match; export blocked.")
    for getter in ("get_qform", "get_sform"):
        if not np.array_equal(getattr(header, getter)(), getattr(after, getter)(), equal_nan=True):
            raise Unsupported("Saved orientation did not match; export blocked.")
    if (reopened.dataobj.slope, reopened.dataobj.inter) != (slope, intercept):
        raise Unsupported("Saved intensity scaling did not match; export blocked.")
    if any(output[a:b].strip(b"\0") for a, b in TEXT.values()) or after.extensions:
        raise Unsupported("Header removal did not verify; export blocked.")
    # NiiVue 0.69 chooses qform when its code is higher; otherwise it uses sform.
    # Keep both original spaces in the export, and verify the displayed one too.
    display_affine = header.get_qform() if qcode > scode else header.get_sform()
    summary = {
        "dimensions": list(dims[1:4]),
        "spacing": spacing.tolist(),
        "units": header.get_xyzt_units()[0],
        "datatype": str(header.get_data_dtype()),
        "orientation": list(nib.aff2axcodes(display_affine)),
        "display_space": "qform" if qcode > scode else "sform",
        "display_affine": display_affine.tolist(),
        "display_scaling": [slope, intercept],
        "voxel_count": count,
        "voxel_bytes": size,
        "dual_spaces": bool(qcode and scode and not np.allclose(forms[0], forms[1])),
    }
    report = {
        "policy": POLICY,
        "operation": "header_only",
        "summary": summary,
        "text_fields_present": [name for name, (a, b) in TEXT.items() if data[a:b].strip(b"\0")],
        "extensions_removed": extensions,
        "discarded_nonvoxel_bytes": len(data) - size - 352,
        "checks": {
            "raw_voxels_unchanged": True,
            "scaling_unchanged": True,
            "geometry_unchanged": True,
            "output_reopened": True,
            "free_text_removed": True,
            "extensions_removed": True,
        },
        "privacy": "Facial anatomy, visible labels and accompanying files remain unassessed.",
        "output_sha256": sha256(output).hexdigest(),
    }
    return NiftiResult(output, summary, report)
