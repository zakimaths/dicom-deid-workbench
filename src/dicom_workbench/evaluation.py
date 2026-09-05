"""Answer-key scoring independent of detector rules; never emits source values or IDs."""

from collections import Counter
from hashlib import sha256
import json
import math
import platform
from pathlib import Path
import time
import tracemalloc
from importlib.metadata import version

from .records import CATEGORIES, POLICY, detect, scrub_text, validate_spans, validate_text


def wilson(successes, total):
    if not total:
        return None
    z = 1.959963984540054
    p, z2 = successes / total, z * z
    middle = (p + z2 / (2 * total)) / (1 + z2 / total)
    half = z * math.sqrt(p * (1 - p) / total + z2 / (4 * total * total)) / (1 + z2 / total)
    return [
        0.0 if successes == 0 else max(0.0, middle - half),
        1.0 if successes == total else min(1.0, middle + half),
    ]


def rate(numerator, denominator):
    return {
        "numerator": numerator,
        "denominator": denominator,
        "rate": numerator / denominator if denominator else None,
        "wilson_95": wilson(numerator, denominator),
    }


def score(text, gold, predictions):
    """Full-span recall, overlap precision and non-PHI character damage, no token averaging."""
    validate_text(text)
    gold = validate_spans(gold, len(text))
    predictions = validate_spans(predictions, len(text))
    if len({(s["start"], s["end"]) for s in gold}) != len(gold):
        raise ValueError("Duplicate answer spans are not allowed.")
    # Partial masking of a name is still an identifier miss.
    truth, mask = bytearray(len(text)), bytearray(len(text))
    for span in gold:
        truth[span["start"] : span["end"]] = b"\1" * (span["end"] - span["start"])
    for span in predictions:
        mask[span["start"] : span["end"]] = b"\1" * (span["end"] - span["start"])
    clean, _ = scrub_text(text, predictions)
    covered = [
        all(mask[i] and (clean[i] == "█" or text[i].isspace()) for i in range(s["start"], s["end"]))
        for s in gold
    ]
    # Use mask for recall, actual changed code points for collateral damage.
    changed = [clean[i] != c for i, c in enumerate(text)]
    return {
        "identifiers": len(gold),
        "removed": sum(covered),
        "missed": len(gold) - sum(covered),
        "suggestions": len(predictions),
        "suggestions_overlapping_phi": sum(any(truth[s["start"] : s["end"]]) for s in predictions),
        "non_phi_characters": len(text) - sum(truth),
        "non_phi_characters_changed": sum(changed[i] and not truth[i] for i in range(len(text))),
        "phi_non_whitespace_characters": sum(
            bool(truth[i]) and not c.isspace() for i, c in enumerate(text)
        ),
        "phi_non_whitespace_characters_removed": sum(
            bool(truth[i]) and bool(mask[i]) and not c.isspace() for i, c in enumerate(text)
        ),
        "by_category": {
            c: {
                "total": sum(s["category"] == c for s in gold),
                "removed": sum(ok and s["category"] == c for s, ok in zip(gold, covered)),
            }
            for c in CATEGORIES
        },
    }


def evaluate(corpus, predictor=detect):
    if not isinstance(corpus, dict) or corpus.get("schema") != 1:
        raise ValueError("Use annotated corpus schema 1.")
    cases = corpus.get("cases")
    if not isinstance(cases, list) or not 1 <= len(cases) <= 10000:
        raise ValueError("Use 1 to 10,000 cases.")
    seen, subjects, prepared = set(), {}, []
    for item in cases:
        if (
            not isinstance(item, dict)
            or item.get("split") not in ("validation", "test")
            or item.get("origin") not in ("synthetic", "public_clinical", "authorised_clinical")
        ):
            raise ValueError("Every case needs a declared split and origin.")
        text = item.get("text")
        validate_text(text)
        subject = item.get("subject")
        if not isinstance(subject, str) or not 1 <= len(subject) <= 128:
            raise ValueError("Each case needs a subject grouping key.")
        digest = sha256(text.encode()).hexdigest()
        if digest in seen or (subject in subjects and subjects[subject] != item["split"]):
            raise ValueError("Duplicate content or subjects crossing splits are not allowed.")
        seen.add(digest)
        subjects[subject] = item["split"]
        spans = validate_spans(item.get("identifiers"), len(text))
        if len({(s["start"], s["end"]) for s in spans}) != len(spans):
            raise ValueError("Duplicate answer spans are not allowed.")
        prepared.append((item, text, spans))
    reports = []
    for split in ("validation", "test"):
        rows, groups = [], {}
        for item, text, spans in prepared:
            if item["split"] != split:
                continue
            started = time.perf_counter()
            tracemalloc.start()
            try:
                # No answer spans, known-identifier list, subject or provenance passed in.
                prediction = predictor(text)
                result = score(text, spans, prediction)
                status = "processed"
            except Exception:
                result = score(text, spans, [])
                status = "processing_error"
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()
            failure = bool(result["missed"] or status != "processed")
            groups[item["subject"]] = groups.get(item["subject"], False) or failure
            rows.append(
                {
                    "case": len(rows) + 1,
                    "origin": item["origin"],
                    "peak_traced_python_bytes": peak,
                    "status": status,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 3),
                    **result,
                }
            )
        totals = Counter()
        for row in rows:
            totals.update(
                {
                    k: row[k]
                    for k in (
                        "identifiers",
                        "removed",
                        "missed",
                        "suggestions",
                        "suggestions_overlapping_phi",
                        "non_phi_characters",
                        "non_phi_characters_changed",
                        "phi_non_whitespace_characters",
                        "phi_non_whitespace_characters_removed",
                    )
                }
            )
        reports.append(
            {
                "split": split,
                "records": len(rows),
                "subject_groups": len(groups),
                "origin_counts": dict(Counter(r["origin"] for r in rows)),
                "processing_errors": sum(r["status"] != "processed" for r in rows),
                "identifier_recall": rate(totals["removed"], totals["identifiers"]),
                "suggestion_overlap_precision": rate(
                    totals["suggestions_overlapping_phi"], totals["suggestions"]
                ),
                "record_failure_rate": rate(
                    sum(bool(r["missed"] or r["status"] != "processed") for r in rows), len(rows)
                ),
                "subject_failure_rate": rate(sum(groups.values()), len(groups)),
                "negative_record_false_positive_rate": rate(
                    sum(r["identifiers"] == 0 and r["suggestions"] > 0 for r in rows),
                    sum(r["identifiers"] == 0 for r in rows),
                ),
                "character_recall": rate(
                    totals["phi_non_whitespace_characters_removed"],
                    totals["phi_non_whitespace_characters"],
                ),
                "character_precision": rate(
                    totals["phi_non_whitespace_characters_removed"],
                    totals["phi_non_whitespace_characters_removed"]
                    + totals["non_phi_characters_changed"],
                ),
                "character_f1": (
                    2
                    * totals["phi_non_whitespace_characters_removed"]
                    / (
                        totals["phi_non_whitespace_characters_removed"]
                        + totals["non_phi_characters_changed"]
                        + totals["phi_non_whitespace_characters"]
                    )
                )
                if totals["phi_non_whitespace_characters_removed"]
                + totals["non_phi_characters_changed"]
                + totals["phi_non_whitespace_characters"]
                else None,
                "non_phi_character_change_rate": rate(
                    totals["non_phi_characters_changed"], totals["non_phi_characters"]
                ),
                "categories": {
                    c: rate(
                        sum(r["by_category"][c]["removed"] for r in rows),
                        sum(r["by_category"][c]["total"] for r in rows),
                    )
                    for c in CATEGORIES
                },
                "latency_ms": {
                    "median": sorted(r["elapsed_ms"] for r in rows)[len(rows) // 2]
                    if rows
                    else None,
                    "p95": sorted(r["elapsed_ms"] for r in rows)[
                        max(0, math.ceil(len(rows) * 0.95) - 1)
                    ]
                    if rows
                    else None,
                },
                "cases": rows,
            }
        )
    return {
        "schema": 1,
        "policy": POLICY,
        "app_version": version("dicom-deid-workbench"),
        "python": platform.python_version(),
        "detector_sha256": sha256(Path(__file__).with_name("records.py").read_bytes()).hexdigest(),
        "scorer_sha256": sha256(Path(__file__).read_bytes()).hexdigest(),
        "corpus_sha256": sha256(
            json.dumps(corpus, sort_keys=True, ensure_ascii=True).encode()
        ).hexdigest(),
        "assistance": "none",
        "reports": reports,
        "interpretation": "Wilson intervals are descriptive. Identifier and character observations within a record are correlated. Subject intervals require independently sampled subjects; template variants are not independent patients. No significance or hospital-readiness claim.",
        "visual_biometrics": "not_evaluated; text references to images do not test faces or fingerprints",
    }
