from io import BytesIO
import json
import zipfile

import pytest
from PIL import Image, PngImagePlugin
from pypdf import PdfWriter

from dicom_workbench.core import Unsupported
from dicom_workbench.documents import extract, extract_isolated
from dicom_workbench.records import detect, scrub_text, CATEGORIES
from dicom_workbench.evaluation import score, evaluate, wilson


@pytest.mark.parametrize(
    "label,value",
    [
        ("Patient", "Alex Example"),
        ("DOB", "14/02/1970"),
        ("MRN", "A-459012"),
        ("NHS number", "123 456 7890"),
        ("Address", "42 Example Road"),
        ("Fax", "+44 1234 555123"),
        ("Email", "example@hospital.test"),
        ("SSN", "123-45-6789"),
        ("Health plan", "H-98345"),
        ("Account", "AC-2033"),
        ("Licence", "LI-788"),
        ("VIN", "ABCDEFG"),
        ("Device serial", "DX-781"),
        ("URL", "https://example.org/patient/42"),
        ("IP", "2001:db8::5"),
        ("Biometric ID", "BIO-981"),
        ("Photo ID", "IMG-004"),
        ("Unique code", "UN-445"),
    ],
)
def test_labelled_identifier_fully_replaced_preserving_clinical_line(label, value):
    text = f"{label}: {value}\nFinding: No acute fracture."
    clean, report = scrub_text(text, detect(text))
    assert value not in clean
    assert clean.endswith("Finding: No acute fracture.")
    assert report["selected_text_replaced"]
    assert value not in json.dumps(report)


def test_unicode_known_values_and_unlabelled_miss_are_explicit():
    text = "😀 Discussed with Ａｌｅｘ Exa\u200bmple and Straße today."
    assert not detect(text)
    spans = detect(text, ["alex example", "STRASSE"])
    clean, _ = scrub_text(text, spans)
    assert "Ａｌｅｘ" not in clean and "Straße" not in clean
    assert clean.startswith("😀 Discussed with ") and clean.endswith(" today.")


@pytest.mark.parametrize(
    "bad",
    [
        None,
        {},
        [{"start": -1, "end": 5, "category": "name"}],
        [{"start": True, "end": 5, "category": "name"}],
        [{"start": 0, "end": 500, "category": "name"}],
        [{"start": 0, "end": 3, "category": "PRIVATE_NAME"}],
    ],
)
def test_bad_spans_fail_closed(bad):
    with pytest.raises(Unsupported):
        scrub_text("Patient text", bad)


def test_json_duplicate_keys_rejected_and_all_keys_visible():
    with pytest.raises(Unsupported):
        extract(b'{"name":"A", "name":"B"}', "json")
    result = extract(b'{"PatientName":"Alex Example","nested":{"email":"a@example.org"}}', "json")
    assert "PatientName" in result["text"] and "a@example.org" in result["text"]
    clean, _ = scrub_text(result["text"], detect(result["text"]))
    assert "Alex Example" not in clean and "a@example.org" not in clean


def test_csv_quoted_cells_and_formula_export_only_text():
    result = extract(b'name,note\n"Alex Example","=cmd|evil"\n', "csv")
    assert result["kind"] == "text"
    clean, _ = scrub_text(result["text"], detect(result["text"]))
    assert "Alex Example" not in clean and "=cmd|evil" in clean


def test_docx_adjacent_runs_and_hidden_parts():
    stream = BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr(
            "word/document.xml",
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Patient: Alex </w:t></w:r><w:r><w:t>Example</w:t></w:r></w:p></w:document>',
        )
        archive.writestr(
            "word/header1.xml",
            '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>MRN: 4455</w:t></w:r></w:p></w:hdr>',
        )
    result = extract(stream.getvalue(), "docx")
    assert "Alex Example" in result["text"] and "4455" in result["text"]
    clean, _ = scrub_text(result["text"], detect(result["text"]))
    assert "Alex" not in clean and "4455" not in clean


def test_pdf_blank_or_encrypted_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    stream = BytesIO()
    writer.write(stream)
    with pytest.raises(Unsupported):
        extract(stream.getvalue(), "pdf")
    writer.encrypt("secret")
    stream = BytesIO()
    writer.write(stream)
    with pytest.raises(Unsupported):
        extract(stream.getvalue(), "pdf")


def test_image_metadata_and_transparent_hidden_pixels_removed():
    import base64

    image = Image.new("RGBA", (5, 5), (12, 34, 56, 0))
    meta = PngImagePlugin.PngInfo()
    meta.add_text("Patient", "PRIVATE_NAME")
    stream = BytesIO()
    image.save(stream, format="PNG", pnginfo=meta)
    result = extract(stream.getvalue(), "png")
    raw = base64.b64decode(result["png"])
    reopened = Image.open(BytesIO(raw))
    assert not reopened.info and b"PRIVATE_NAME" not in raw
    assert reopened.getpixel((0, 0)) == (255, 255, 255)


def test_isolated_reader_works_and_generic_failure():
    assert extract_isolated(b"Patient: Alex Example", "txt")["text"] == "Patient: Alex Example"
    with pytest.raises(Unsupported, match="File reading failed"):
        extract_isolated(b"PRIVATE_NAME not a pdf", "pdf")


def test_independent_scoring_partial_labels_damage_and_empty_denominators():
    text = "Alex Example is well."
    gold = [{"start": 0, "end": 12, "category": "name"}]
    partial = [{"start": 0, "end": 4, "category": "name"}]
    result = score(text, gold, partial)
    assert result["missed"] == 1
    result = score(text, gold, [{"start": 0, "end": len(text), "category": "name"}])
    assert result["removed"] == 1 and result["non_phi_characters_changed"] > 0
    assert wilson(0, 0) is None
    lo, hi = wilson(0, 100)
    assert lo == 0 and 0.036 < hi < 0.038
    lo, hi = wilson(100, 100)
    assert 0.962 < lo < 0.964 and hi == 1


def corpus():
    return {
        "schema": 1,
        "cases": [
            {
                "subject": "LOCAL_SUBJECT",
                "split": "test",
                "origin": "synthetic",
                "text": "Patient: Alex Example",
                "identifiers": [{"start": 9, "end": 21, "category": "name"}],
            }
        ],
    }


def test_evaluator_errors_count_as_failures_and_does_not_emit_values():
    data = corpus()
    report = evaluate(data, predictor=lambda _: (_ for _ in ()).throw(ValueError("PRIVATE")))
    test = report["reports"][1]
    assert test["identifier_recall"]["numerator"] == 0 and test["processing_errors"] == 1
    assert test["subject_failure_rate"]["rate"] == 1
    assert all(v not in json.dumps(report) for v in ("LOCAL_SUBJECT", "Alex", "PRIVATE"))
    assert set(test["categories"]) == set(CATEGORIES)
    assert test["categories"]["face"]["rate"] is None


def test_duplicate_content_and_cross_split_subjects_rejected():
    data = corpus()
    data["cases"].append(dict(data["cases"][0]))
    with pytest.raises(ValueError):
        evaluate(data)
    data["cases"][1]["text"] = "Different text"
    data["cases"][1]["identifiers"] = []
    data["cases"][1]["split"] = "validation"
    with pytest.raises(ValueError):
        evaluate(data)


def test_labelled_apostrophe_and_empty_value_do_not_consume_next_line():
    text = "Patient: Sam O'Connor\nMRN:\nFinding: No acute fracture."
    clean, _ = scrub_text(text, detect(text))
    assert "O'Connor" not in clean and clean.endswith("Finding: No acute fracture.")


def test_high_bit_depth_picture_rejected_instead_of_clipped():
    image = Image.new("I;16", (5, 5))
    stream = BytesIO()
    image.save(stream, format="PNG")
    with pytest.raises(Unsupported, match="High-bit-depth"):
        extract(stream.getvalue(), "png")


def test_full_fixture_corpus_scored_without_answer_key_assistance():
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "fixture_corpus", Path(__file__).parents[1] / "scripts/build_record_corpus.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = evaluate(module.build())
    result = report["reports"][1]
    assert result["records"] == 600 and result["identifier_recall"]["denominator"] == 570
    assert result["identifier_recall"]["numerator"] == 540
    assert result["record_failure_rate"]["numerator"] == 30
    assert result["non_phi_character_change_rate"]["numerator"] == 0
    assert result["negative_record_false_positive_rate"]["numerator"] == 0
    assert result["processing_errors"] == 0
    assert result["subject_groups"] == 76


def test_pdf_text_extraction_omits_original_container_metadata():
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=200)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 10 100 Td (Patient: Alex Example) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.add_metadata({"/Author": "PRIVATE_AUTHOR"})
    output = BytesIO()
    writer.write(output)
    result = extract_isolated(output.getvalue(), "pdf")
    assert "Alex Example" in result["text"] and "PRIVATE_AUTHOR" not in json.dumps(result)
    clean, _ = scrub_text(result["text"], detect(result["text"]))
    assert "Alex Example" not in clean


def test_jpeg_orientation_and_exif_are_normalised_without_metadata():
    import base64

    image = Image.new("RGB", (10, 20), "white")
    exif = Image.Exif()
    exif[274] = 6
    exif[315] = "PRIVATE_ARTIST"
    stream = BytesIO()
    image.save(stream, format="JPEG", exif=exif)
    result = extract_isolated(stream.getvalue(), "jpeg")
    assert (result["width"], result["height"]) == (20, 10)
    raw = base64.b64decode(result["png"])
    assert b"PRIVATE_ARTIST" not in raw and not Image.open(BytesIO(raw)).info


def test_dense_repeated_known_values_stop_at_candidate_bound():
    with pytest.raises(Unsupported, match="Too many possible identifiers"):
        detect("a" * 200_000, ["aa"] * 200)
