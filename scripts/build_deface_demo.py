"""Rebuild the teaching comparison from a hash-pinned, locally supplied MNI archive.

Usage: PYTHONPATH=src .venv/bin/python scripts/build_deface_demo.py tmp/mni-2009c.zip
No patient inputs or network requests. Source redistribution terms ship alongside assets.
"""

import gzip
from hashlib import sha256
import json
from pathlib import Path
import sys
from zipfile import ZipFile

import nibabel as nib
import numpy as np

from dicom_workbench.nifti import inspect
from dicom_workbench.nifti_deface import deface

ARCHIVE_SHA = "804382e5d68a42ff8096ee845a7600b6658434da762fa67840a149eb25d48bd4"
SOURCE = "https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009"
OUT = Path("src/dicom_workbench/web/nifti-assets")


def build(path):
    archive = Path(path).read_bytes()
    assert sha256(archive).hexdigest() == ARCHIVE_SHA, "Unexpected source archive"
    with ZipFile(path) as z:
        (OUT / "MNI-LICENSE.txt").write_bytes(z.read("COPYING"))

        def read(suffix):
            name = "mni_icbm152_nlin_asym_09c/mni_icbm152_t1_tal_nlin_asym_09c" + suffix + ".nii"
            return nib.Nifti1Image.from_bytes(z.read(name))

        original = read("")
        affine = original.affine @ np.diag([2, 2, 2, 1])

        def encode(values):
            img = nib.Nifti1Image(values, affine)
            img.set_sform(affine, 4)
            img.set_qform(affine, 0)
            img.header.set_xyzt_units("mm")
            return inspect(img.to_bytes()).data

        before = encode(
            np.rint(np.maximum(original.get_fdata()[::2, ::2, ::2], 0) * 10).astype(np.uint16)
        )
        brain = encode((read("_mask").get_fdata()[::2, ::2, ::2] > 0.5).astype(np.uint8))
        result = deface(before, brain)
        selected = np.asarray(nib.Nifti1Image.from_bytes(result.mask).dataobj).astype(bool)
        overlap = {}
        for region in ("face", "eye"):
            area = read("_" + region + "_mask").get_fdata()[::2, ::2, ::2] > 0.5
            overlap[region] = {
                "atlas_region_voxels": int(area.sum()),
                "selected_for_zeroing": int((area & selected).sum()),
                "outside_removal": int((area & ~selected).sum()),
            }
        entries = {}
        for name, raw in {
            "before": before,
            "after": result.data,
            "removal": result.mask,
            "brain": brain,
        }.items():
            # Python 3.12's fast gzip path reports the host OS in byte 9.
            # Canonicalise it so macOS/Linux do not produce different fingerprints.
            packed = bytearray(gzip.compress(raw, mtime=0))
            packed[9] = 255
            packed = bytes(packed)
            filename = f"deface-{name}.nii.gz"
            (OUT / filename).write_bytes(packed)
            entries[name] = {
                "file": filename,
                "sha256": sha256(packed).hexdigest(),
                "summary": inspect(packed).summary,
            }
        manifest = {
            "title": "MNI average head · prepared defacing comparison",
            "notes": "Population-average T1 anatomy, not an individual patient. A 2 mm teaching copy with non-negative intensities rounded to 0.1 units. The supplied atlas brain mask guides an experimental removal; inspect every direction for remaining facial anatomy and unwanted changes.",
            "source": SOURCE,
            "license": "MNI permission notice",
            "credit": "Fonov et al.; McGill / MNI",
            "archive_sha256": ARCHIVE_SHA,
            "preparation": [
                "Take every second voxel in each axis; update affine (no interpolation).",
                "Clip negative T1 values to zero, multiply by ten and round to uint16.",
                "Threshold supplied brain/face/eye masks at 0.5 on the same sampled grid.",
                "Write fresh valid NIfTI-1 headers; slope 1, intercept 0.",
                "Apply quickshear-physical-v1 with a 5 mm margin.",
            ],
            "files": entries,
            "report": result.report,
            "atlas_region_overlap": overlap,
            "evaluation_limit": "One population-average template. Atlas-region overlap is not face-recognition accuracy, privacy recall, or validation on independent patients. The eye mask is a broad atlas region, not a precise eyeball segmentation.",
        }
        (OUT / "deface-demo.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(
            json.dumps(
                {
                    "changed_voxels": result.report["changed_voxels"],
                    "brain_changes": result.report["brain_mask_voxels_changed"],
                    "atlas_overlap": overlap,
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    build(sys.argv[1])
