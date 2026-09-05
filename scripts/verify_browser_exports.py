"""Independently decode actual browser downloads and compare canvas values with pydicom."""

from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import sys

import numpy as np
import pydicom
from pydicom.pixels import apply_windowing

from dicom_workbench.fixtures import synthetic_dicom
from dicom_workbench.samples import SAMPLES, sample_dicom


def main():
    root = Path("output/browser")
    checked = 0
    for browser in sys.argv[1:]:
        for key in [*SAMPLES, "erased"]:
            source = pydicom.dcmread(
                BytesIO(synthetic_dicom(with_text=True) if key == "erased" else sample_dicom(key))
            )
            raw = (root / f"{browser}-{key}.dcm").read_bytes()
            out = pydicom.dcmread(BytesIO(raw))
            report = json.loads((root / f"{browser}-{key}.json").read_text())
            assert sha256(raw).hexdigest() == report["output_sha256"]
            assert not out.PatientName and not out.PatientID
            assert not any(e.tag.is_private or e.VR == "SQ" for e in out)
            assert source.SOPInstanceUID != out.SOPInstanceUID
            expected = source.pixel_array.copy()
            if key == "erased":
                expected[12:26, 16:148] = -32768
                assert not np.any(out.pixel_array == 2000)
                assert report["redaction"]["selected_pixels"] == 1848
            else:
                # pydicom's independent LINEAR implementation, normalised to 8-bit display.
                pixels = source.pixel_array.astype(np.float64)
                slope, intercept = (
                    float(source.get("RescaleSlope", 1)),
                    float(source.get("RescaleIntercept", 0)),
                )
                pixels = pixels * slope + intercept
                if "WindowCenter" not in source:
                    source.WindowCenter = (float(pixels.min()) + float(pixels.max()) + 1) / 2
                    source.WindowWidth = max(1, float(pixels.max()) - float(pixels.min()) + 1)
                windowed = apply_windowing(pixels, source)
                low, high = (-32768, 32767) if source.PixelRepresentation else (0, 65535)
                low, high = low * slope + intercept, high * slope + intercept
                gray = np.floor(
                    np.clip((windowed - low) / (high - low) * 255, 0, 255) + 0.5
                ).astype(np.uint8)
                if source.PhotometricInterpretation == "MONOCHROME1":
                    gray = 255 - gray
                canvas = np.frombuffer(
                    (root / f"{browser}-{key}.rgba").read_bytes(), dtype=np.uint8
                ).reshape(*gray.shape, 4)
                np.testing.assert_array_equal(
                    canvas[:, :, :3], np.repeat(gray[:, :, None], 3, axis=2)
                )
                assert np.all(canvas[:, :, 3] == 255)
            np.testing.assert_array_equal(out.pixel_array, expected)
            checked += 1
    print(
        f"Independent pydicom/NumPy checks passed for {checked} browser exports and their public-sample previews."
    )


if __name__ == "__main__":
    main()
