import subprocess
import sys


def test_cli_roundtrip_and_no_overwrite(tmp_path):
    source, output, report = [
        tmp_path / name for name in ("synthetic.dcm", "scrubbed.dcm", "report.json")
    ]
    command = [sys.executable, "-m", "dicom_workbench.cli"]
    assert subprocess.run(command + ["fixture", str(source)], capture_output=True).returncode == 0
    original = source.read_bytes()
    assert (
        subprocess.run(
            command + ["scrub", str(source), str(output), "--report", str(report)],
            capture_output=True,
        ).returncode
        == 0
    )
    assert source.read_bytes() == original
    assert output.exists() and report.exists()
    assert (
        subprocess.run(
            command + ["scrub", str(source), str(source)], capture_output=True
        ).returncode
        == 1
    )
    assert source.read_bytes() == original


def test_cli_text_redaction_and_invalid_selection(tmp_path):
    import json
    from hashlib import sha256

    source, output, report, regions = [
        tmp_path / n for n in ("text.dcm", "redacted.dcm", "report.json", "regions.json")
    ]
    command = [sys.executable, "-m", "dicom_workbench.cli"]
    assert (
        subprocess.run(
            command + ["fixture", str(source), "--with-text"], capture_output=True
        ).returncode
        == 0
    )
    regions.write_text("null")
    args = ["scrub", str(source), str(output), "--regions", str(regions), "--report", str(report)]
    assert subprocess.run(command + args, capture_output=True).returncode == 1
    assert not output.exists()
    regions.write_text('[{"x":16,"y":12,"width":132,"height":14}]')
    assert subprocess.run(command + args, capture_output=True).returncode == 0
    result = json.loads(report.read_text())
    assert result["output_sha256"] == sha256(output.read_bytes()).hexdigest()
    assert result["redaction"]["selected_pixels"] == 1848
