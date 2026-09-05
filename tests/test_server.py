from http.client import HTTPConnection
import json
import threading

import pytest

from dicom_workbench.server import WorkbenchServer
from dicom_workbench.samples import SAMPLES
from dicom_workbench.teaching import teaching_assets


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


@pytest.mark.parametrize("kind", SAMPLES)
def test_public_sample_routes(local, kind):
    path = f"/api/samples/{kind}"
    assert req(local, path, "POST")[0] == 403
    headers = {"X-Workbench-Token": local.token}
    assert req(local, path, "POST", {**headers, "Origin": "https://attacker.example"})[0] == 403
    status, data, _ = req(local, path, "POST", headers)
    assert status == 200
    result = json.loads(data)
    assert result["sample"]["file"] == SAMPLES[kind]["file"]
    assert not result["synthetic"]
    assert result["image"]["modality"] == kind.split("-")[0].upper()
    assert req(local, f"/api/jobs/{result['job']}/dicom", headers=headers)[0] == 200
    assert req(local, "/api/samples/unknown", "POST", headers)[0] == 404
    assert req(local, "/api/samples/../../secret", "POST", headers)[0] == 404
    req(local, "/api/clear", "POST", headers)
    assert local.result is None


def test_redaction_replaces_job_and_rejects_stale_export(local):
    headers = {"X-Workbench-Token": local.token, "Content-Type": "application/json"}
    assert req(local, "/api/redact", "POST")[0] == 403
    old = json.loads(req(local, "/api/demo", "POST", headers)[1])["job"]
    body = json.dumps({"job": old, "regions": [{"x": 0, "y": 0, "width": 10, "height": 10}]})
    status, data, _ = req(local, "/api/redact", "POST", headers, body)
    assert status == 200
    result = json.loads(data)
    assert result["job"] != old
    assert result["report"]["redaction"]["selected_pixels"] == 100
    assert req(local, f"/api/jobs/{old}/dicom", headers=headers)[0] == 404
    assert req(local, f"/api/jobs/{result['job']}/dicom", headers=headers)[0] == 200
    # Stale edits invalidate the current export too.
    assert req(local, "/api/redact", "POST", headers, body)[0] == 422
    assert local.result is None


@pytest.mark.parametrize("regions", [None, [], {}, [{"x": 0, "y": 0, "width": 99999, "height": 1}]])
def test_invalid_redaction_discards_export(local, regions):
    headers = {"X-Workbench-Token": local.token, "Content-Type": "application/json"}
    old = json.loads(req(local, "/api/demo", "POST", headers)[1])["job"]
    assert (
        req(local, "/api/redact", "POST", headers, json.dumps({"job": old, "regions": regions}))[0]
        == 422
    )
    assert local.result is None


@pytest.mark.parametrize("name", ["Host", "Origin", "X-Workbench-Token", "Content-Length"])
def test_duplicate_security_headers_are_rejected(local, name):
    connection = HTTPConnection("127.0.0.1", local.server_port, timeout=5)
    connection.putrequest("POST", "/api/demo", skip_host=True)
    values = {
        "Host": f"127.0.0.1:{local.server_port}",
        "Origin": f"http://127.0.0.1:{local.server_port}",
        "X-Workbench-Token": local.token,
        "Content-Length": "0",
    }
    for key, value in values.items():
        connection.putheader(key, value)
    connection.putheader(name, values[name])
    connection.endheaders()
    response = connection.getresponse()
    assert response.status == 400
    response.read()
    connection.close()


@pytest.mark.parametrize(
    "selection",
    [
        '[{"x":0,"x":1,"y":0,"width":1,"height":1}]',
        '[{"x":NaN,"y":0,"width":1,"height":1}]',
        '[{"x":0,"y":0,"width":Infinity,"height":1}]',
    ],
)
def test_ambiguous_json_invalidates_export(local, selection):
    headers = {"X-Workbench-Token": local.token, "Content-Type": "application/json"}
    job = json.loads(req(local, "/api/demo", "POST", headers)[1])["job"]
    body = '{"job":' + json.dumps(job) + ',"regions":' + selection + "}"
    assert req(local, "/api/redact", "POST", headers, body)[0] == 422
    assert local.result is None


def test_teaching_routes_preserve_local_security(local):
    for path, mime in teaching_assets().items():
        status, body, headers = req(local, "/" + path)
        assert status == 200 and body
        assert headers["Content-Type"] == mime
        assert headers["X-Content-Type-Options"] == "nosniff"
    for path in (
        "/teaching/../core.py",
        "/teaching/unknown.jpg",
        "/teaching/catalog.json?extra=1",
        "/teaching/%2e%2e/server.py",
    ):
        assert req(local, path)[0] == 404
    assert (
        req(local, "/teaching/catalog.json", headers={"Origin": "https://attacker.example"})[0]
        == 403
    )


@pytest.mark.parametrize("asset", ["exercise.js", "exercise-core.js", "exercise-png.js"])
def test_exercise_scripts_keep_local_security(local, asset):
    status, body, headers = req(local, "/" + asset)
    assert status == 200 and body
    assert headers["Cache-Control"] == "no-store"
    assert "text/javascript" in headers["Content-Type"]
    assert req(local, "/" + asset, headers={"Origin": "https://attacker.example"})[0] == 403
