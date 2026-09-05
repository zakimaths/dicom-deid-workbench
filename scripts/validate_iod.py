"""Independent validator gate on permitted fixtures only; never print its raw output."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import tempfile
from dicom_workbench.core import transform
from dicom_workbench.fixtures import synthetic_dicom
from dicom_workbench.samples import SAMPLES, sample_dicom

VERSION = "1.00.snapshot.20260803085716"
ARCHIVE_SHA256 = "c1d1feb60a1b206862c52db5a4e3115987c134467332f3397957050e4a83e5e1"
KNOWN_WARNINGS = ("needed to build DICOMDIR", "is only permitted to be empty when actually unknown")


def validate_fixture(executable, data):
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "fixture.dcm"
        path.write_bytes(data)
        run = subprocess.run(
            [str(executable), str(path)], capture_output=True, text=True, timeout=30
        )
    lines = (run.stdout + run.stderr).splitlines()
    errors = sum(line.startswith("Error") for line in lines)
    warnings = [line for line in lines if line.startswith("Warning")]
    unknown = sum(not any(known in line for known in KNOWN_WARNINGS) for line in warnings)
    return {
        "passed": run.returncode == 0 and errors == 0 and unknown == 0,
        "errors": errors,
        "reviewed_warnings": len(warnings) - unknown,
        "unreviewed_warnings": unknown,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--validator", type=Path, required=True)
    args = parser.parse_args()
    version = subprocess.run(
        [str(args.validator), "-version"], capture_output=True, text=True, timeout=10
    )
    if VERSION not in version.stdout + version.stderr:
        parser.error("Use the documented pinned validator version.")
    cases = {"synthetic": synthetic_dicom(), "synthetic-text": synthetic_dicom(True)}
    cases.update({k: sample_dicom(k) for k in SAMPLES})
    results = {}
    for key, raw in cases.items():
        for mode, regions in [
            ("preserve", None),
            ("erase", [{"x": 0, "y": 0, "width": 2, "height": 2}]),
        ]:
            results[f"{key}-{mode}"] = validate_fixture(
                args.validator, transform(raw, regions).dicom
            )
    # A zero exit code alone is insufficient: dciodvfy sometimes emits errors with exit 0.
    from io import BytesIO
    import pydicom

    broken = pydicom.dcmread(BytesIO(transform(cases["mr"]).dicom))
    del broken.ScanningSequence
    buffer = BytesIO()
    pydicom.dcmwrite(buffer, broken, enforce_file_format=True)
    negative = validate_fixture(args.validator, buffer.getvalue())
    assert not negative["passed"] and negative["errors"] > 0
    report = {
        "validator": VERSION,
        "binary_sha256": sha256(args.validator.read_bytes()).hexdigest(),
        "cases": results,
        "negative_control_caught": True,
        "warning_review": "Empty identity fields cannot form a DICOMDIR; laterality is unknown, not inferred from anatomy.",
        "privacy_certification": False,
    }
    out = Path("output/iod-validation.json")
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(
        f"{sum(r['passed'] for r in results.values())}/{len(results)} independent DICOM checks passed; negative control caught."
    )
    if not all(r["passed"] for r in results.values()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
