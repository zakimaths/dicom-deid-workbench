"""Extract review material; never return a modified original PDF or Office container."""

from io import BytesIO, StringIO
import base64
import csv
import json
from concurrent.futures import ThreadPoolExecutor
import time
import subprocess
import sys
import warnings
import zipfile
import xml.etree.ElementTree as ET

from .core import Unsupported, MAX_BYTES
from .records import MAX_TEXT, validate_text

KINDS = ("txt", "csv", "json", "pdf", "docx", "png", "jpg", "jpeg")


def extract(raw, kind):
    if kind not in KINDS or not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_BYTES:
        raise Unsupported("Choose TXT, CSV, JSON, PDF, DOCX, PNG or JPEG, up to 8 MiB.")
    notices = []
    if kind in ("png", "jpg", "jpeg"):
        from PIL import Image, ImageOps

        with warnings.catch_warnings():
            warnings.simplefilter("error")
            image = Image.open(BytesIO(raw))
            if image.format not in ("PNG", "JPEG") or getattr(image, "n_frames", 1) != 1:
                raise Unsupported("Choose a single PNG or JPEG image.")
            if image.width * image.height > 1704 * 1704:
                raise Unsupported(
                    "Choose an image with at most 2.9 million pixels; resizing is not automatic."
                )
            if image.mode in ("I", "F", "I;16", "I;16B", "I;16L"):
                raise Unsupported(
                    "High-bit-depth pictures need a dedicated imaging reader; automatic conversion is disabled."
                )
            image.load()
            image = ImageOps.exif_transpose(image).convert("RGBA")
            # Flatten hidden RGB under alpha onto white; new container has no inherited metadata.
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.getchannel("A"))
            output = BytesIO()
            background.save(output, format="PNG")
        return {
            "kind": "image",
            "png": base64.b64encode(output.getvalue()).decode(),
            "width": background.width,
            "height": background.height,
            "notices": [
                "Metadata removed from the new PNG. Visible text and faces still require review. Colour/orientation are normalised; this is a review picture, not a diagnostic export."
            ],
        }
    if kind == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(raw), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= 30:
            raise Unsupported("Choose an unencrypted PDF with 1 to 30 pages.")
        pages = []
        for index, page in enumerate(reader.pages, 1):
            # Decoding itself is bounded by the isolated worker's memory/time limits.
            text = page.extract_text() or ""
            if not text.strip():
                raise Unsupported(
                    "A PDF page has no extractable text. Review it as an image instead."
                )
            pages.append(f"[Page {index}]\n{text}")
            if sum(map(len, pages)) > MAX_TEXT:
                raise Unsupported("The document contains too much text.")
        text = "\n\n".join(pages)
        notices.append(
            "Text-only extract. Pictures, handwriting, attachments, annotations and layout are not reproduced or scrubbed. Check the original for missing clinical information. Only a new TXT file can be saved."
        )
    elif kind == "docx":
        with zipfile.ZipFile(BytesIO(raw)) as archive:
            entries = archive.infolist()
            if (
                len(entries) > 500
                or len({i.filename for i in entries}) != len(entries)
                or sum(i.file_size for i in entries) > 16 * 1024 * 1024
            ):
                raise Unsupported("The document package is too large or ambiguous.")
            if "word/document.xml" not in archive.namelist():
                raise Unsupported("Choose a standard DOCX document.")
            paragraphs = []
            for item in entries:
                if item.filename.startswith("word/") and item.filename.endswith(".xml"):
                    xml = archive.read(item)
                    if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
                        raise Unsupported("XML entities are not supported.")
                    root = ET.fromstring(xml)
                    for element in root.iter():
                        if (
                            element.tag
                            == "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
                        ):
                            value = "".join(
                                e.text or ""
                                for e in element.iter()
                                if e.tag.rsplit("}", 1)[-1] in ("t", "delText", "instrText")
                            )
                            if value:
                                paragraphs.append(value)
            text = "\n".join(paragraphs)
        notices.append(
            "Text-only extract, including available headers, footers, comments and revisions. Images, embedded files and layout are omitted. Only a new TXT file can be saved."
        )
    elif kind == "json":

        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise Unsupported("Duplicate JSON keys are not supported.")
                result[key] = value
            return result

        text = json.dumps(
            json.loads(
                raw.decode("utf-8-sig"),
                object_pairs_hook=unique,
                parse_constant=lambda _: (_ for _ in ()).throw(ValueError()),
            ),
            ensure_ascii=False,
            indent=2,
        )
        notices.append(
            "Review copy of all JSON keys and values. Export is TXT; this does not produce a validated FHIR resource."
        )
    elif kind == "csv":
        rows = list(csv.reader(StringIO(raw.decode("utf-8-sig")), strict=True))
        if not rows or not rows[0] or any(len(r) != len(rows[0]) for r in rows[1:]):
            raise Unsupported("Choose a CSV with a header and consistent columns.")
        text = "\n\n".join(
            "\n".join(f"{key}: {value}" for key, value in zip(rows[0], row)) for row in rows[1:]
        )
        notices.append(
            "Rows become labelled text for review. Export is TXT so spreadsheet formulas cannot execute; table formatting is not retained."
        )
    else:
        text = raw.decode("utf-8-sig")
    validate_text(text)
    return {"kind": "text", "text": text, "notices": notices}


def extract_isolated(raw, kind):
    """Third-party parsers run with a wall timeout and Unix resource limits, no logs."""
    if kind not in KINDS or not 0 < len(raw) <= MAX_BYTES:
        raise Unsupported("Choose a supported file up to 8 MiB.")
    try:
        with (
            subprocess.Popen(
                [sys.executable, "-m", "dicom_workbench.document_worker", kind],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            ) as process,
            ThreadPoolExecutor(max_workers=1) as pool,
        ):
            response = pool.submit(process.communicate, raw)
            started = time.monotonic()
            try:
                while not response.done():
                    if time.monotonic() - started > 15:
                        raise ValueError("Parser timeout")
                    if sys.platform == "darwin" and process.poll() is None:
                        measured = subprocess.run(
                            ["/bin/ps", "-o", "rss=", "-p", str(process.pid)],
                            capture_output=True,
                            timeout=1,
                            check=False,
                        )
                        value = measured.stdout.strip()
                        if value and int(value) > 512 * 1024:
                            raise ValueError("Parser memory watchdog")
                    time.sleep(0.05)
                output, _ = response.result()
                if process.returncode:
                    raise ValueError("Parser failure")
                return json.loads(output)
            finally:
                if process.poll() is None:
                    process.kill()
                process.wait()
    except (subprocess.SubprocessError, ValueError, OSError):
        raise Unsupported(
            "File reading failed or exceeded its limits. Check the format, size and whether it is encrypted."
        ) from None
