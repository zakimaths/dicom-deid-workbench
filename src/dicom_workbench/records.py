"""Local, review-required text scrubbing. Rules suggest spans; they do not certify anonymity.

Offsets are Unicode code points in the extracted text, not bytes or UTF-16 units.
Known identifiers are optional reviewer input, never learned from evaluation answer keys.
"""

from collections import Counter
from hashlib import sha256
from importlib.metadata import version
import re
import unicodedata

from .core import Unsupported

POLICY = "hospital-text-review-v1"
MAX_TEXT = 200_000
CATEGORIES = (
    "name",
    "geography",
    "date_age",
    "phone",
    "fax",
    "email",
    "ssn",
    "medical_record",
    "health_plan",
    "account",
    "licence",
    "vehicle",
    "device",
    "url",
    "ip",
    "biometric",
    "face",
    "other_identifier",
)
# These are deliberately visible, reviewable rules, not an unnamed clinical NER model.
FIELD_LABELS = {
    "name": r"patient(?:[ _-]?name)?|(?:first|last|given|family|maiden)[ _-]?name|surname|forename|name|physician|doctor|consultant|next[ _-]?of[ _-]?kin",
    "geography": r"address|street|city|county|postcode|zip(?:[ _-]?code)?",
    "date_age": r"dob|date[ _-]?of[ _-]?birth|birth[ _-]?date|admission[ _-]?date|discharge[ _-]?date|age",
    "phone": r"phone|telephone|mobile|tel",
    "fax": r"fax",
    "email": r"email|e-mail",
    "ssn": r"ssn|social[ _-]?security(?:[ _-]?number)?",
    "medical_record": r"mrn|nhs(?:[ _-]?(?:number|no))?|patient[ _-]?id|medical[ _-]?record(?:[ _-]?(?:number|no))?",
    "health_plan": r"health[ _-]?plan(?:[ _-]?id)?|insurance(?:[ _-]?(?:number|id))?|member[ _-]?id",
    "account": r"account(?:[ _-]?(?:number|no|id))?|iban",
    "licence": r"licen[cs]e(?:[ _-]?(?:number|no))?|passport(?:[ _-]?(?:number|no))?",
    "vehicle": r"vehicle(?:[ _-]?id)?|vin|registration|number[ _-]?plate",
    "device": r"device(?:[ _-]?(?:id|serial))?|serial(?:[ _-]?(?:number|no))?|udi",
    "url": r"url|website",
    "ip": r"ip(?:[ _-]?address)?",
    "biometric": r"biometric(?:[ _-]?id)?|fingerprint(?:[ _-]?id)?|voiceprint(?:[ _-]?id)?",
    "face": r"photo(?:[ _-]?id)?|face(?:[ _-]?id)?",
    "other_identifier": r"identifier|unique[ _-]?code|accession(?:[ _-]?(?:number|no))?",
}
PATTERNS = [
    ("email", re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?!\w)")),
    ("url", re.compile(r"\b(?:https?://|www\.)[^\s<>\"']+", re.I)),
    ("ip", re.compile(r"(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])")),
    ("ip", re.compile(r"(?<![\w:])(?:[0-9a-f]{1,4}:){2,7}[0-9a-f:]{0,39}(?![\w:])", re.I)),
    ("ssn", re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")),
    ("medical_record", re.compile(r"(?<!\d)\d{3}[ \u00a0]\d{3}[ \u00a0]\d{4}(?!\d)")),
    (
        "phone",
        re.compile(r"(?<!\w)(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,5}\)|\d{3,5})[ .-]\d{3}[ .-]\d{4}(?!\d)"),
    ),
    (
        "date_age",
        re.compile(r"(?<!\d)(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})(?!\d)"),
    ),
    (
        "date_age",
        re.compile(
            r"\b(?:\d{1,2}\s+)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:\d{1,2},?\s+)?\d{4}\b",
            re.I,
        ),
    ),
    ("date_age", re.compile(r"\b(?:9\d|1\d{2})[ -](?:years?[ -]old|year[ -]old|y/?o)\b", re.I)),
    ("geography", re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)),
]
LABEL_PATTERNS = [
    (
        category,
        re.compile(
            r"(?<!\w)(?:"
            + labels
            + r""")[\"']?[ \t]*[:=][ \t]*(?:"(?P<quoted>[^"\r\n]+)"|(?P<value>[^\r\n,;|}]+))""",
            re.I,
        ),
    )
    for category, labels in FIELD_LABELS.items()
]


def validate_text(text):
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT:
        raise Unsupported("Choose non-empty text with at most 200,000 characters.")
    if any(0xD800 <= ord(c) <= 0xDFFF for c in text):
        raise Unsupported("Text contains an invalid Unicode character.")


def validate_spans(spans, length):
    if not isinstance(spans, list) or len(spans) > 10000:
        raise Unsupported("Choose at most 10,000 text selections.")
    result = []
    for span in spans:
        if not isinstance(span, dict) or set(span) != {"start", "end", "category"}:
            raise Unsupported("A text selection is malformed.")
        start, end, category = span["start"], span["end"], span["category"]
        if type(start) is not int or type(end) is not int or not 0 <= start < end <= length:
            raise Unsupported("Text selections must lie inside the current text.")
        if category not in CATEGORIES:
            raise Unsupported("Choose a supported identifier category.")
        result.append(dict(span))
    return result


def detect(text, known=()):
    validate_text(text)
    if not isinstance(known, (list, tuple)) or len(known) > 200:
        raise Unsupported("Provide at most 200 known identifiers.")
    spans = []
    for category, pattern in [*LABEL_PATTERNS, *PATTERNS]:
        for match in pattern.finditer(text):
            start, end = (
                (match.span("quoted") if match.group("quoted") is not None else match.span("value"))
                if "value" in pattern.groupindex
                else match.span()
            )
            # Labelled values can include trailing whitespace; don't erase the next field.
            while end > start and text[end - 1].isspace():
                end -= 1
            if end > start:
                spans.append({"start": start, "end": end, "category": category})
    # Case-insensitive exact matching, with length-preserving normalization mapping.
    normalized, positions = [], []
    for index, char in enumerate(text):
        replacement = unicodedata.normalize("NFKC", char).casefold()
        if unicodedata.category(char) == "Cf":
            continue
        normalized.append(replacement)
        positions.extend([index] * len(replacement))
    normalized = "".join(normalized)
    for item in known:
        if not isinstance(item, str) or not 2 <= len(item) <= 256 or not item.strip():
            raise Unsupported("Each known identifier must contain 2 to 256 characters.")
        query = "".join(
            unicodedata.normalize("NFKC", c).casefold()
            for c in item
            if unicodedata.category(c) != "Cf"
        )
        if not query:
            raise Unsupported("A known identifier contains no visible text.")
        for match in re.finditer(re.escape(query), normalized):
            spans.append(
                {
                    "start": positions[match.start()],
                    "end": positions[match.end() - 1] + 1,
                    "category": "other_identifier",
                }
            )
    # Keep category distinctions for auditing; remove exact duplicates only.
    return validate_spans(
        [
            dict(start=s, end=e, category=c)
            for s, e, c in sorted({(s["start"], s["end"], s["category"]) for s in spans})
        ],
        len(text),
    )


def scrub_text(text, spans):
    validate_text(text)
    spans = validate_spans(spans, len(text))
    mask = bytearray(len(text))
    for span in spans:
        mask[span["start"] : span["end"]] = b"\1" * (span["end"] - span["start"])
    clean = "".join("█" if mask[i] and not c.isspace() else c for i, c in enumerate(text))
    # Independent postcondition: every selected non-whitespace code point is replaced;
    # every unselected character remains exact. No HTML overlays or hidden originals.
    if any(
        (clean[i] != "█" if mask[i] and not c.isspace() else clean[i] != c)
        for i, c in enumerate(text)
    ):
        raise Unsupported("Text replacement verification failed.")
    return clean, {
        "schema": 1,
        "app_version": version("dicom-deid-workbench"),
        "policy": POLICY,
        "status": "review_required",
        "source_characters": len(text),
        "redacted_characters": sum(mask),
        "selections": len(spans),
        "category_counts": dict(Counter(s["category"] for s in spans)),
        "output_sha256": sha256(clean.encode()).hexdigest(),
        "selected_text_replaced": True,
        "unselected_text_unchanged": True,
        "anonymity": "not_established",
        "automatic_recall": "not_measured_without_answer_key",
    }
