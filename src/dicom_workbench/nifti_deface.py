"""Mask-guided whole-volume shearing. Experimental; privacy still requires review.

Derived from the Quickshear lower-hull construction (Schimke & Hale, 2011),
using physical distances and explicit grid indexing. See docs/nifti-defacing.md.
"""

from dataclasses import dataclass
from hashlib import sha256

import nibabel as nib
import numpy as np

from .core import Unsupported
from .nifti import inspect, _inspect_decoded

POLICY = "quickshear-physical-v1"


@dataclass
class DefaceResult:
    data: bytes
    mask: bytes
    report: dict
    summary: dict


def _raw(image):
    return np.asanyarray(image.dataobj.get_unscaled())


def _grid(image):
    h = image.header
    q, s = int(h["qform_code"]), int(h["sform_code"])
    affine = h.get_qform() if q > s else h.get_sform()
    if q and s and not np.allclose(h.get_qform(), h.get_sform(), rtol=0, atol=1e-5):
        raise Unsupported(
            "Defacing needs one unambiguous coordinate space. The two transforms differ."
        )
    linear = affine[:3, :3]
    unit = linear / np.linalg.norm(linear, axis=0)
    # Reorientation may permute/flip axes, but never interpolate the input.
    if not np.allclose(np.abs(unit).sum(axis=0), 1, atol=1e-6, rtol=0):
        raise Unsupported(
            "Oblique or sheared volumes need external review; this defacer does not resample them."
        )
    return affine


def _lower_hull(points):
    hull = []
    for p in points:
        while len(hull) > 1:
            a, b = hull[-2], hull[-1]
            cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
            if cross > 0:
                break
            hull.pop()
        hull.append(p)
    if len(hull) < 2 or hull[1][0] <= hull[0][0]:
        raise Unsupported("The brain mask has no usable sagittal boundary.")
    return hull


def _mask_bytes(mask, reference):
    image = nib.Nifti1Image(mask.astype(np.uint8), reference.affine)
    image.set_qform(reference.get_qform(), int(reference.header["qform_code"]))
    image.set_sform(reference.get_sform(), int(reference.header["sform_code"]))
    image.header.set_xyzt_units("mm")
    return inspect(image.to_bytes()).data


def deface(raw: bytes, brain_raw: bytes, margin_mm=5.0) -> DefaceResult:
    try:
        return _deface(raw, brain_raw, margin_mm)
    except Unsupported:
        raise
    except Exception:
        raise Unsupported(
            "The volume and mask could not be verified. No defaced export was created."
        ) from None


def _deface(raw, brain_raw, margin_mm):
    if (
        isinstance(margin_mm, bool)
        or not isinstance(margin_mm, (int, float))
        or not np.isfinite(margin_mm)
        or not 2 <= margin_mm <= 20
    ):
        raise Unsupported("Choose a brain protection margin from 2 to 20 mm.")
    source, mask_source = inspect(raw), inspect(brain_raw)
    image, brain_image = (
        nib.Nifti1Image.from_bytes(source.data),
        nib.Nifti1Image.from_bytes(mask_source.data),
    )
    affine, mask_affine = _grid(image), _grid(brain_image)
    if image.shape != brain_image.shape or not np.allclose(affine, mask_affine, atol=1e-5, rtol=0):
        raise Unsupported(
            "The brain mask must have exactly the scan's dimensions and coordinate grid."
        )
    if source.summary["display_scaling"] != [1.0, 0.0] or mask_source.summary[
        "display_scaling"
    ] != [1.0, 0.0]:
        raise Unsupported(
            "This defacing profile requires unscaled voxel values (slope 1, intercept 0)."
        )
    values, brain_values = _raw(image), _raw(brain_image)
    if values.min() < 0 or not np.all((brain_values == 0) | (brain_values == 1)):
        raise Unsupported(
            "Use a non-negative structural MRI and a binary brain mask containing only 0 and 1."
        )
    brain = brain_values.astype(bool)
    occupied = np.count_nonzero(brain)
    if occupied < 64 or occupied > brain.size * 0.8:
        raise Unsupported("The brain mask is empty, too small or covers nearly the whole scan.")
    if any(np.take(brain, [0, -1], axis=a).any() for a in range(3)):
        raise Unsupported(
            "The brain mask touches a scan boundary. Review coverage before defacing."
        )
    orientation = nib.orientations.io_orientation(affine)
    rps = nib.orientations.axcodes2ornt("RPS")
    forward = nib.orientations.ornt_transform(orientation, rps)
    backward = nib.orientations.ornt_transform(rps, orientation)
    protected = nib.orientations.apply_orientation(brain, forward)
    rps_affine = affine @ nib.orientations.inv_ornt_aff(forward, image.shape)
    spacing = np.linalg.norm(rps_affine[:3, :3], axis=0)
    profile = protected.any(axis=0)
    points = [
        (float(p * spacing[1]), float(np.flatnonzero(profile[p])[0] * spacing[2]))
        for p in range(profile.shape[0])
        if profile[p].any()
    ]
    hull = _lower_hull(points)
    a, b = hull[:2]
    slope = (b[1] - a[1]) / (b[0] - a[0])
    intercept = a[1] - slope * a[0] - margin_mm * np.sqrt(1 + slope * slope)
    posterior = np.arange(profile.shape[0])[:, None] * spacing[1]
    superior = np.arange(profile.shape[1])[None, :] * spacing[2]
    remove_rps = np.broadcast_to(superior < slope * posterior + intercept, protected.shape)
    remove = nib.orientations.apply_orientation(remove_rps, backward)
    if np.any(remove & brain):
        raise Unsupported("The proposed removal overlaps the brain mask. Export blocked.")
    changed = remove & (values != 0)
    changed_count = int(np.count_nonzero(changed))
    if not changed_count:
        raise Unsupported(
            "This proposal changes no non-zero voxels. It is not a successful defacing result."
        )
    output_values = values.copy()
    output_values[remove] = 0
    # Preserve the exact validated header and storage representation. No float re-encoding.
    output = source.data[:352] + output_values.tobytes(order="F")
    verified = _inspect_decoded(output)
    after = _raw(nib.Nifti1Image.from_bytes(verified.data))
    if (
        not np.array_equal(after[~remove], values[~remove])
        or np.any(after[remove])
        or not np.array_equal(after[brain], values[brain])
    ):
        raise Unsupported("Saved voxel verification failed. Export blocked.")
    if verified.data[:352] != source.data[:352]:
        raise Unsupported("Saved geometry or header changed unexpectedly. Export blocked.")
    removal_mask = _mask_bytes(remove, image)
    changed_slices = [
        np.flatnonzero(np.any(changed, axis=tuple(b for b in range(3) if b != a))).tolist()
        for a in range(3)
    ]
    voxel_mm3 = float(abs(np.linalg.det(affine[:3, :3])))
    report = {
        "policy": POLICY,
        "operation": "mask_guided_volume_shear",
        "status": "manual_review_required",
        "margin_mm": float(margin_mm),
        "voxel_count": int(values.size),
        "selected_voxels": int(np.count_nonzero(remove)),
        "changed_voxels": changed_count,
        "changed_mm3": changed_count * voxel_mm3,
        "brain_mask_voxels": int(occupied),
        "brain_mask_voxels_changed": 0,
        "outside_selection_voxels_changed": 0,
        "changed_slices_by_storage_axis": changed_slices,
        "output_sha256": sha256(verified.data).hexdigest(),
        "removal_mask_sha256": sha256(removal_mask).hexdigest(),
        "checks": {
            "output_reopened": True,
            "geometry_unchanged": True,
            "outside_selection_unchanged": True,
            "inside_selection_zero": True,
            "provided_brain_mask_preserved": True,
            "header_cleaned": True,
        },
        "header": source.report,
        "privacy": "The supplied mask may miss brain tissue. Remaining face, ears, eyes, labels and re-identification risk require independent review. No anonymity certification.",
    }
    return DefaceResult(verified.data, removal_mask, report, verified.summary)


def process_request(raw):
    """NDF1 + two bounded file lengths + margin, then the two opaque file bodies."""
    import json
    import struct
    from .nifti import MAX_INPUT

    if len(raw) < 16:
        raise Unsupported("The volume pair is incomplete.")
    magic, first, second, margin = struct.unpack_from("<4sIIf", raw)
    if (
        magic != b"NDF1"
        or not 0 < first <= MAX_INPUT
        or not 0 < second <= MAX_INPUT
        or len(raw) != 16 + first + second
    ):
        raise Unsupported("The volume pair framing is invalid.")
    result = deface(raw[16 : 16 + first], raw[16 + first :], margin)
    meta = json.dumps(
        {
            "report": result.report,
            "summary": result.summary,
            "mask_summary": inspect(result.mask).summary,
        },
        allow_nan=False,
    ).encode()
    return (
        struct.pack("<4sIII", b"NDR1", len(meta), len(result.data), len(result.mask))
        + meta
        + result.data
        + result.mask
    )
