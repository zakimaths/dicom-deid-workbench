"""Deterministic geometric phantom. No clinical image or patient data is used."""

from array import array
from io import BytesIO
import math
import sys

import pydicom
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.sequence import Sequence
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian

from .core import IMPLEMENTATION_UID


def synthetic_dicom(with_text=False) -> bytes:
    meta = FileMetaDataset()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    meta.MediaStorageSOPClassUID = CTImageStorage
    meta.MediaStorageSOPInstanceUID = "2.25.100000000000000000000000000000000001"
    meta.ImplementationClassUID = IMPLEMENTATION_UID
    meta.SourceApplicationEntityTitle = "SYNTHETIC_SITE"
    ds = FileDataset(None, {}, file_meta=meta, preamble=b"SYNTHETIC_IDENTIFIER".ljust(128, b"\0"))
    ds.SOPClassUID = CTImageStorage
    ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID = "2.25.100000000000000000000000000000000002"
    ds.SeriesInstanceUID = "2.25.100000000000000000000000000000000003"
    ds.FrameOfReferenceUID = "2.25.100000000000000000000000000000000004"
    ds.PatientName = "SYNTHETIC^EXAMPLE"
    ds.PatientID = "FAKE-PATIENT-001"
    ds.PatientBirthDate = "19700101"
    ds.PatientSex = "O"
    ds.StudyDate = "20260101"
    ds.StudyTime = "120000"
    ds.AccessionNumber = "FAKE-ACCESSION"
    ds.ReferringPhysicianName = "SYNTHETIC^DOCTOR"
    ds.InstitutionName = "Imaginary Test Facility"
    ds.StudyDescription = "Synthetic geometric phantom"
    ds.StudyID = "1"
    ds.Modality = "CT"
    ds.Manufacturer = "Synthetic generator"
    ds.SeriesNumber = 1
    ds.InstanceNumber = 1
    ds.ImageType = ["ORIGINAL", "PRIMARY", "AXIAL"]
    ds.PatientPosition = "HFS"
    ds.PositionReferenceIndicator = ""
    ds.ImagePositionPatient = [0, 0, 0]
    ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
    ds.PixelSpacing = [1, 1]
    ds.SliceThickness = 1
    ds.KVP = 120
    ds.AcquisitionNumber = 1
    ds.Rows = ds.Columns = 256
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 1
    ds.RescaleSlope = 1
    ds.RescaleIntercept = 0
    ds.RescaleType = "HU"
    ds.WindowCenter = 40
    ds.WindowWidth = 400
    ds.BurnedInAnnotation = "NO"
    child = Dataset()
    child.PatientName = "NESTED^FAKE_NAME"
    ds.RequestAttributesSequence = Sequence([child])
    ds.add_new(0x00110010, "LO", "SYNTHETIC_PRIVATE")
    ds.add_new(0x00111001, "LO", "FAKE_PRIVATE_IDENTIFIER")
    pixels = array("h")
    for y in range(256):
        for x in range(256):
            dx, dy = x - 127.5, y - 127.5
            radius = math.hypot(dx, dy)
            value = -1000
            if radius < 107:
                value = 70 + round(9 * math.sin(x / 7) * math.cos(y / 9))
            if 99 < radius < 105:
                value = 950
            for i, density in enumerate([-180, -90, 0, 80, 160, 350]):
                angle = i * math.tau / 6 - math.pi / 2
                if math.hypot(dx - 62 * math.cos(angle), dy - 62 * math.sin(angle)) < 16:
                    value = density
            if abs(dx) < 18 and abs(dy) < 18:
                value = 40 + int(dx // 4) * 30
            pixels.append(value)
    if with_text:
        # Original 5x7 glyphs, deliberately fake identifier for the redaction exercise.
        glyphs = {
            "F": [31, 16, 16, 30, 16, 16, 16],
            "A": [14, 17, 17, 31, 17, 17, 17],
            "K": [17, 18, 20, 24, 20, 18, 17],
            "E": [31, 16, 16, 30, 16, 16, 31],
            "I": [31, 4, 4, 4, 4, 4, 31],
            "D": [30, 17, 17, 17, 17, 17, 30],
            "1": [4, 12, 4, 4, 4, 4, 14],
            "2": [14, 17, 1, 2, 4, 8, 31],
            "3": [30, 1, 1, 14, 1, 1, 30],
            " ": [0] * 7,
        }
        for letter, char in enumerate("FAKE ID 123"):
            for row, bits in enumerate(glyphs[char]):
                for col in range(5):
                    for dy in range(2):
                        for dx in range(2):
                            pixels[(12 + row * 2 + dy) * 256 + 16 + letter * 12 + col * 2 + dx] = (
                                2000 if bits & (1 << (4 - col)) else -1000
                            )
        # Missing annotation status remains unassessed; do not claim the pixels are clean.
        del ds.BurnedInAnnotation
        ds.StudyDescription = "Synthetic text-redaction exercise"
    if sys.byteorder != "little":
        pixels.byteswap()
    ds.PixelData = pixels.tobytes()
    buffer = BytesIO()
    pydicom.dcmwrite(buffer, ds, enforce_file_format=True)
    return buffer.getvalue()
