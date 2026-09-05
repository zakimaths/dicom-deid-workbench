from http.client import HTTPConnection
import json
import threading

import pytest

from dicom_workbench.server import WorkbenchServer


@pytest.fixture
def local():
    server = WorkbenchServer(("127.0.0.1", 0))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    yield server
    server.shutdown()
    server.server_close()
    worker.join()


def req(server, path, method="GET", headers=None, body=None):
    connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
    connection.request(method, path, body=body, headers=headers or {})
    response = connection.getresponse()
    result = response.status, response.read(), dict(response.getheaders())
    connection.close()
    return result


def test_assets_and_no_store(local):
    status, body, headers = req(local, "/")
    assert status == 200 and b"DICOM Workbench" in body
    assert headers["Cache-Control"] == "no-store"
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert req(local, "/../../pyproject.toml")[0] == 404


@pytest.mark.parametrize(
    "font", ["jetbrains-mono-regular", "jetbrains-mono-semibold", "press-start-2p"]
)
def test_local_font_assets_keep_security_headers(local, font):
    status, body, headers = req(local, f"/fonts/{font}.ttf")
    assert status == 200 and body[:4] == b"\x00\x01\x00\x00"
    assert headers["Content-Type"] == "font/ttf"
    assert headers["Cache-Control"] == "no-store"
    assert "default-src 'self'" in headers["Content-Security-Policy"]
    assert req(local, "/fonts/../../core.py")[0] == 404


def test_token_host_origin_and_cross_site_checks(local):
    assert req(local, "/api/demo", "POST")[0] == 403
    assert req(local, "/api/session", headers={"Host": "attacker.example"})[0] == 403
    assert req(local, "/api/session", headers={"Origin": "https://attacker.example"})[0] == 403
    assert req(local, "/api/session", headers={"Sec-Fetch-Site": "cross-site"})[0] == 403


def test_demo_download_clear_and_failed_import(local):
    session = json.loads(req(local, "/api/session")[1])
    headers = {"X-Workbench-Token": session["token"]}
    status, data, _ = req(local, "/api/demo", "POST", headers)
    assert status == 200
    job = json.loads(data)["job"]
    path = f"/api/jobs/{job}/dicom"
    assert req(local, path)[0] == 403
    status, output, response_headers = req(local, path, headers=headers)
    assert status == 200 and output[128:132] == b"DICM"
    assert "metadata-scrubbed.dcm" in response_headers["Content-Disposition"]
    status, report, _ = req(local, f"/api/jobs/{job}/report", headers=headers)
    assert status == 200 and b"FAKE-PATIENT" not in report
    assert (
        req(
            local,
            "/api/process",
            "POST",
            {**headers, "Content-Type": "application/dicom"},
            b"SECRET_INVALID",
        )[0]
        == 422
    )
    assert req(local, path, headers=headers)[0] == 404
    req(local, "/api/demo", "POST", headers)
    req(local, "/api/clear", "POST", headers)
    assert local.result is None


def test_expiry_and_oversized_request(local):
    headers = {"X-Workbench-Token": local.token}
    req(local, "/api/demo", "POST", headers)
    local.created -= 601
    local.service_actions()
    assert local.result is None
    assert req(local, "/api/process", "POST", {**headers, "Content-Length": "99999999"})[0] == 422
