"""Rebuild reviewed teaching assets from a hash-checked CC0 source. No download in CI."""

import gzip
from hashlib import md5, sha256
import json
from pathlib import Path
import sys

import nibabel as nib

from dicom_workbench.nifti import inspect
from dicom_workbench.nifti_fixtures import phantom

OUT = Path(__file__).resolve().parents[1] / "src/dicom_workbench/web/nifti-assets"
source = Path(sys.argv[1])
raw = source.read_bytes()
if sha256(raw).hexdigest() != "2bbe4430223d9b9ce47d4dab3ff398a69fefbb481cbf3bd136e07f363a73919c":
    raise ValueError("Unexpected source: use the recorded OpenNeuro object")
image = nib.load(source).slicer[::2, ::2, ::2]
clean = inspect(image.to_bytes())
(OUT / "brain-t1.nii.gz").write_bytes(gzip.compress(clean.data, mtime=0))
(OUT / "phantom.nii.gz").write_bytes(gzip.compress(phantom(), mtime=0))
records = [
    {
        "file": "brain-t1.nii.gz",
        "title": "Brain MRI · T1 structural volume",
        "notes": "Explore the folded cerebral cortex, the corpus callosum and cerebellum. Axial cuts look from below, coronal cuts from the front, sagittal cuts from the side. The public source has altered facial regions; these are not normal anatomy. This teaching copy takes every second voxel along each axis and preserves spatial coordinates.",
        "source": "https://doi.org/10.18112/openneuro.ds000114.v1.0.2",
        "license": "CC0",
        "credit": "Gorgolewski KJ, Storkey A, Bastin ME, Whittle IR, Wardlaw JM, Pernet CR",
        "source_md5": md5(raw).hexdigest(),
        "source_sha256": sha256(raw).hexdigest(),
        "source_url": "https://s3.amazonaws.com/openneuro.org/ds000114/sub-01/ses-test/anat/sub-01_ses-test_T1w.nii.gz",
        "summary": clean.summary,
    },
    {
        "file": "phantom.nii.gz",
        "title": "Orientation test · asymmetric blocks",
        "notes": "Synthetic blocks, not a scan. The brighter block is on the right. Unequal voxel spacing checks that the viewer preserves proportions. The file contains three explicitly fake text fields and one fake extension for local cleaning practice.",
        "source": "https://github.com/zakimaths/dicom-deid-workbench",
        "license": "MIT",
        "credit": "DICOM Workbench synthetic fixture",
        "summary": inspect(phantom()).summary,
    },
]
for r in records:
    r["sha256"] = sha256((OUT / r["file"]).read_bytes()).hexdigest()
(OUT / "samples.json").write_text(json.dumps(records, indent=2) + "\n")
print("Built two reproducible NIfTI teaching assets")
