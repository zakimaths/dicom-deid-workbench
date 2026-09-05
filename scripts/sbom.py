"""Combine npm's SPDX inventory with locked Python packages and shipped OCR file hashes."""

from hashlib import sha256
import json
from pathlib import Path
import subprocess
import tomllib

root = Path(__file__).resolve().parents[1]
report = json.loads(
    subprocess.check_output(["npm", "sbom", "--sbom-format", "spdx"], text=True, cwd=root)
)
for package in tomllib.loads((root / "uv.lock").read_text())["package"]:
    identifier = "SPDXRef-Python-" + package["name"]
    report["packages"].append(
        {
            "SPDXID": identifier,
            "name": package["name"],
            "versionInfo": package["version"],
            "downloadLocation": "NOASSERTION",
            "filesAnalyzed": False,
            "licenseConcluded": "NOASSERTION",
            "licenseDeclared": "NOASSERTION",
            "copyrightText": "NOASSERTION",
        }
    )
    report.setdefault("relationships", []).append(
        {
            "spdxElementId": "SPDXRef-DOCUMENT",
            "relationshipType": "DESCRIBES",
            "relatedSpdxElement": identifier,
        }
    )
report["files"] = [
    {
        "SPDXID": f"SPDXRef-OCR-{i}",
        "fileName": "ocr-assets/" + name,
        "checksums": [{"algorithm": "SHA256", "checksumValue": digest}],
        "licenseConcluded": "NOASSERTION",
        "copyrightText": "NOASSERTION",
    }
    for i, (name, digest) in enumerate(
        json.loads((root / "src/dicom_workbench/web/ocr-assets/manifest.json").read_text()).items()
    )
]
for i, path in enumerate(sorted((root / "src/dicom_workbench/web/nifti-assets").iterdir())):
    if path.is_file():
        report["files"].append(
            {
                "SPDXID": f"SPDXRef-NIfTI-{i}",
                "fileName": "nifti-assets/" + path.name,
                "checksums": [
                    {"algorithm": "SHA256", "checksumValue": sha256(path.read_bytes()).hexdigest()}
                ],
                "licenseConcluded": "NOASSERTION",
                "copyrightText": "NOASSERTION",
            }
        )
out = root / "output/sbom.spdx.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(report, indent=2) + "\n")
print(
    "SBOM written: development/build dependencies and shipped OCR assets, not just browser runtime."
)
