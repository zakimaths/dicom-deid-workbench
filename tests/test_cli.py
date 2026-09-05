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
