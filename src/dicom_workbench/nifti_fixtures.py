"""Deterministic asymmetric geometry fixture; no anatomical or patient data."""

import nibabel as nib
import numpy as np


def phantom(endian="<", datatype=np.int16):
    a = np.zeros((32, 40, 48), dtype=datatype)
    a[4:28, 5:35, 6:42] = 80
    a[4:10, 15:25, 15:33] = 160  # left marker
    a[22:28, 12:28, 12:36] = 240  # brighter right marker
    affine = np.diag([2.0, 3.0, 4.0, 1.0])
    affine[:3, 3] = [-32, -60, -96]
    image = nib.Nifti1Image(a, affine)
    image.set_qform(affine, 1)
    image.set_sform(affine, 1)
    image.header.set_xyzt_units("mm", "sec")
    image.header["descrip"] = b"FAKE NAME: ALEX EXAMPLE"
    image.header["aux_file"] = b"FAKE-ID-ONLY"
    image.header["intent_name"] = b"FAKE LABEL"
    if endian == ">":
        image = nib.Nifti1Image(a, affine, image.header.as_byteswapped())
    image.header.extensions.append(nib.nifti1.Nifti1Extension(6, b"FAKE HOSPITAL NOTE"))
    return image.to_bytes()
