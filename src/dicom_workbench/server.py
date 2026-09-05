"""Single-user loopback service, without upload spooling or patient-data logging."""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import secrets
import time

from .nifti import MAX_INPUT as NIFTI_MAX_INPUT, inspect as inspect_nifti
from .documents import extract_isolated
from .records import detect, scrub_text
from .core import MAX_BYTES, Unsupported, transform
from .fixtures import synthetic_dicom
from .samples import SAMPLES, sample_dicom
from .selection import load_selection
from .teaching import teaching_assets

STATIC = Path(__file__).parent / "web"
TTL_SECONDS = 600


class WorkbenchServer(HTTPServer):
    def __init__(self, address):
        super().__init__(address, Handler)
        self.token = secrets.token_urlsafe(32)
        self.result = None
        self.job = None
        self.created = 0
        self.teaching_assets = {
            "/" + name: (name, mime) for name, mime in teaching_assets().items()
        }

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(10)
        return connection, address

    def handle_error(self, request, client_address):
        # Never print request data, filenames or DICOM exceptions to terminal logs.
        pass

    def clear(self):
        self.result = None
        self.job = None
        self.created = 0

    def service_actions(self):
        if self.result is not None and time.monotonic() - self.created > TTL_SECONDS:
            self.clear()


class Handler(BaseHTTPRequestHandler):
    server_version = "DICOMWorkbench"
    sys_version = ""

    def log_message(self, *args):
        pass

    def respond(self, code, data, content_type="application/json", filename=None):
        if not isinstance(data, bytes):
            data = json.dumps(data, allow_nan=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            (
                "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
            ).replace("img-src 'self' blob:", "img-src 'self' blob: data:")
            if self.path == "/nifti"
            else "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        )
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(data)

    def trusted(self, token=False):
        for name in (
            "Host",
            "Origin",
            "Sec-Fetch-Site",
            "X-Workbench-Token",
            "X-Record-Kind",
            "Content-Length",
            "Content-Type",
            "Transfer-Encoding",
        ):
            if len(self.headers.get_all(name, [])) > 1:
                self.respond(400, {"error": "Ambiguous request headers are not accepted."})
                return False
        port = self.server.server_port
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin")
        if host not in hosts or (origin is not None and origin != f"http://{host}"):
            self.respond(403, {"error": "This service accepts same-origin local requests only."})
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.respond(403, {"error": "Cross-site requests are not accepted."})
            return False
        if token and not secrets.compare_digest(
            self.headers.get("X-Workbench-Token", ""), self.server.token
        ):
            self.respond(403, {"error": "Session expired. Reload the page."})
            return False
        return True

    def do_GET(self):
        if not self.trusted():
            return
        assets = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/records": ("records.html", "text/html; charset=utf-8"),
            "/records.js": ("records.js", "text/javascript; charset=utf-8"),
            "/records.css": ("records.css", "text/css; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
            "/pixels.js": ("pixels.js", "text/javascript; charset=utf-8"),
            "/style.css": ("style.css", "text/css; charset=utf-8"),
            "/teaching.css": ("teaching.css", "text/css; charset=utf-8"),
            "/exercise.js": ("exercise.js", "text/javascript; charset=utf-8"),
            "/challenge.js": ("challenge.js", "text/javascript; charset=utf-8"),
            "/challenge-score.js": ("challenge-score.js", "text/javascript; charset=utf-8"),
            "/ocr.js": ("ocr.js", "text/javascript; charset=utf-8"),
            "/build-info.js": ("build-info.js", "text/javascript; charset=utf-8"),
            "/exercise-core.js": ("exercise-core.js", "text/javascript; charset=utf-8"),
            "/exercise-png.js": ("exercise-png.js", "text/javascript; charset=utf-8"),
            "/teaching.js": ("teaching.js", "text/javascript; charset=utf-8"),
            "/favicon.svg": ("favicon.svg", "image/svg+xml"),
            "/fonts/jetbrains-mono-regular.ttf": ("fonts/jetbrains-mono-regular.ttf", "font/ttf"),
            "/fonts/jetbrains-mono-semibold.ttf": ("fonts/jetbrains-mono-semibold.ttf", "font/ttf"),
            "/fonts/press-start-2p.ttf": ("fonts/press-start-2p.ttf", "font/ttf"),
        }
        assets.update(
            {
                "/nifti": ("nifti.html", "text/html; charset=utf-8"),
                "/nifti.js": ("nifti.js", "text/javascript"),
                "/nifti-local.js": ("nifti-local.js", "text/javascript"),
                "/nifti.css": ("nifti.css", "text/css"),
                **{
                    "/nifti-assets/" + name: ("nifti-assets/" + name, mime)
                    for name, mime in {
                        "niivue-0.69.0.js": "text/javascript",
                        "samples.json": "application/json",
                        "brain-t1.nii.gz": "application/octet-stream",
                        "phantom.nii.gz": "application/octet-stream",
                    }.items()
                },
            }
        )
        assets.update(self.server.teaching_assets)
        ocr_manifest = json.loads((STATIC / "ocr-assets/manifest.json").read_text())
        assets.update(
            {
                "/ocr-assets/" + n: (
                    "ocr-assets/" + n,
                    "text/javascript" if n.endswith(".js") else "application/octet-stream",
                )
                for n in ocr_manifest
            }
        )
        if self.path in assets:
            name, mime = assets[self.path]
            return self.respond(200, (STATIC / name).read_bytes(), mime)
        if self.path == "/api/session":
            return self.respond(200, {"token": self.server.token, "max_bytes": MAX_BYTES})
        if not self.path.startswith("/api/jobs/"):
            return self.respond(404, {"error": "Not found."})
        if not self.trusted(token=True):
            return
        parts = self.path.split("/")
        if (
            len(parts) != 5
            or self.server.result is None
            or parts[3] != self.server.job
            or time.monotonic() - self.server.created > TTL_SECONDS
        ):
            return self.respond(404, {"error": "This image has expired. Import it again."})
        result = self.server.result
        if parts[4] == "pixels":
            return self.respond(200, result.pixels, "application/octet-stream")
        if parts[4] == "dicom":
            return self.respond(200, result.dicom, "application/dicom", "metadata-scrubbed.dcm")
        if parts[4] == "report":
            return self.respond(200, result.report, filename="metadata-report.json")
        self.respond(404, {"error": "Not found."})

    def do_POST(self):
        if not self.trusted(token=True):
            return
        if self.path in ("/api/nifti/inspect", "/api/nifti/clean"):
            return self.nifti()
        if self.path in ("/api/records/import", "/api/records/detect", "/api/records/scrub"):
            return self.records()
        sample_key = self.path.removeprefix("/api/samples/")
        if self.path not in (
            "/api/demo",
            "/api/demo-text",
            "/api/process",
            "/api/clear",
            "/api/redact",
        ) and not (self.path.startswith("/api/samples/") and sample_key in SAMPLES):
            return self.respond(404, {"error": "Not found."})
        if self.path == "/api/redact":
            return self.redact()
        # Every new import invalidates the previous result, even when import fails.
        self.server.clear()
        try:
            if self.headers.get("Transfer-Encoding"):
                raise Unsupported("Streaming uploads are not supported.")
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > MAX_BYTES:
                raise Unsupported("This version accepts files up to 8 MiB.")
            if self.path == "/api/clear":
                return self.respond(200, {"cleared": True})
            if self.path in ("/api/demo", "/api/demo-text"):
                data = synthetic_dicom(with_text=self.path == "/api/demo-text")
            elif self.path.startswith("/api/samples/"):
                data = sample_dicom(sample_key)
            else:
                if self.headers.get("Content-Type") != "application/dicom":
                    raise Unsupported("Upload a DICOM file as application/dicom.")
                data = self.rfile.read(length)
                if len(data) != length:
                    raise Unsupported("The upload was incomplete.")
            result = transform(data)
            self.server.result = result
            self.server.job = secrets.token_urlsafe(18)
            self.server.created = time.monotonic()
            self.respond(
                200,
                {
                    "job": self.server.job,
                    "image": result.image,
                    "report": result.report,
                    "synthetic": self.path in ("/api/demo", "/api/demo-text"),
                    "text_exercise": self.path == "/api/demo-text",
                    "sample": SAMPLES[sample_key]
                    if self.path.startswith("/api/samples/")
                    else None,
                },
            )
        except Unsupported as error:
            self.respond(422, {"error": str(error)})
        except Exception:
            self.respond(
                422, {"error": "The file could not be processed. Try the synthetic example."}
            )

    def nifti(self):
        # Stateless, bounded input; no patient filenames or original values in reports.
        try:
            if (
                self.headers.get("Transfer-Encoding")
                or self.headers.get("Content-Type") != "application/octet-stream"
            ):
                raise Unsupported("Send one complete NIfTI file.")
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= NIFTI_MAX_INPUT:
                raise Unsupported("Choose a NIfTI file up to 32 MiB.")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise Unsupported("The upload was incomplete.")
            result = inspect_nifti(raw)
            if self.path.endswith("/clean"):
                return self.respond(
                    200, result.data, "application/octet-stream", "header-cleaned.nii"
                )
            self.respond(200, {"summary": result.summary, "report": result.report})
        except Unsupported as error:
            self.respond(422, {"error": str(error)})
        except Exception:
            self.respond(422, {"error": "The volume could not be verified. No export was created."})

    def records(self):
        # Stateless: source text and exports stay in the caller, never a server job/cache.
        try:
            if self.headers.get("Transfer-Encoding"):
                raise Unsupported("Streaming uploads are not supported.")
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BYTES:
                raise Unsupported("Choose a file or request up to 8 MiB.")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise Unsupported("The upload was incomplete.")
            if self.path == "/api/records/import":
                if self.headers.get("Content-Type") != "application/octet-stream":
                    raise Unsupported("Send a supported file for local review.")
                result = extract_isolated(raw, self.headers.get("X-Record-Kind", ""))
            else:
                if self.headers.get("Content-Type") != "application/json":
                    raise Unsupported("Send a JSON text selection.")
                body = json.loads(raw)
                if not isinstance(body, dict):
                    raise Unsupported("Send a text review object.")
                if self.path.endswith("detect"):
                    result = {"spans": detect(body.get("text"), body.get("known", []))}
                else:
                    clean, report = scrub_text(body.get("text"), body.get("spans"))
                    result = {"text": clean, "report": report}
            self.respond(200, result)
        except Unsupported as error:
            self.respond(422, {"error": str(error)})
        except Exception:
            self.respond(422, {"error": "Could not read this record. Check the file or selection."})

    def redact(self):
        previous, previous_job = self.server.result, self.server.job
        expired = time.monotonic() - self.server.created > TTL_SECONDS
        # Failed edits also invalidate the old download. Never return a stale export.
        self.server.clear()
        try:
            if previous is None or expired:
                return self.respond(404, {"error": "This image has expired. Import it again."})
            if (
                self.headers.get("Transfer-Encoding")
                or self.headers.get("Content-Type") != "application/json"
            ):
                raise Unsupported("Send a small JSON selection for the current image.")
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8192:
                raise Unsupported("The region selection is too large or empty.")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise Unsupported("The region selection was incomplete.")
            selection = load_selection(raw)
            if not isinstance(selection, dict) or set(selection) != {"job", "regions"}:
                raise Unsupported("Choose regions for the current image.")
            if not isinstance(selection["regions"], list) or not selection["regions"]:
                raise Unsupported("Select at least one rectangle before applying an edit.")
            if selection["job"] != previous_job:
                raise Unsupported("The selected image is no longer current. Import it again.")
            if previous.report["redaction"]["regions"]:
                raise Unsupported(
                    "This image has already been edited. Import it again to change the selection."
                )
            result = transform(previous.dicom, regions=selection["regions"])
            # Preserve the original metadata action report; add the pixel operation.
            result.report["actions"] = [
                dict(a, action="replaced") if a["tag"] == "(7FE0,0010)" else dict(a)
                for a in previous.report["actions"]
            ]
            result.report["counts"] = {
                action: sum(a["action"] == action for a in result.report["actions"])
                for action in ("removed", "emptied", "replaced", "kept")
            }
            self.server.result, self.server.job = result, secrets.token_urlsafe(18)
            self.server.created = time.monotonic()
            self.respond(
                200, {"job": self.server.job, "image": result.image, "report": result.report}
            )
        except Unsupported as error:
            self.respond(422, {"error": str(error)})
        except Exception:
            self.respond(
                422, {"error": "The selection could not be verified. Import the image again."}
            )


def serve(port=8765):
    server = WorkbenchServer(("127.0.0.1", port))
    print(f"DICOM Workbench: http://127.0.0.1:{server.server_port}")
    print("Local review prototype. Process only authorised data. Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.clear()
        server.server_close()
