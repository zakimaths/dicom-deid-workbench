"""Deterministic engineering corpus; template variants are not clinical subjects.

Gold is assembled by the fixture writer, not by invoking detector code. Challenge
cases deliberately contain unlabeled identifiers to expose limits of automatic rules.
"""

import json
from pathlib import Path

# Separate fixture specification: no import from the detector/rule implementation.
EXAMPLES = [
    ("name", "Patient", "Alex O’Connor"),
    ("geography", "Address", "42 Example Road"),
    ("date_age", "DOB", "14 February 1970"),
    ("phone", "Telephone", "+44 1632 960001"),
    ("fax", "Fax", "+44 1632 960002"),
    ("email", "Email", "alex@example.org"),
    ("ssn", "SSN", "123-45-6789"),
    ("medical_record", "MRN", "AB-458921"),
    ("health_plan", "Health plan", "PLAN-902"),
    ("account", "Account", "ACC-472"),
    ("licence", "Licence", "LIC-8721"),
    ("vehicle", "VIN", "VEH-4560"),
    ("device", "Device serial", "DEV-7112"),
    ("url", "URL", "https://example.org/record/42"),
    ("ip", "IP", "2001:db8::42"),
    ("biometric", "Biometric ID", "BIO-456"),
    ("face", "Photo ID", "PHOTO-457"),
    ("other_identifier", "Unique code", "UNI-999"),
]


def build():
    cases = []
    for split, count in [("validation", 180), ("test", 540)]:
        for index in range(count):
            category, label, value = EXAMPLES[index % len(EXAMPLES)]
            # Four presentations, independently specified gold offsets. Numerical case
            # prefix distinguishes content without pretending these are independent people.
            prefix = f"Practice record {split} {index:04d}\n"
            style = (index // 18) % 4
            if style == 0:
                body = f"{label}: {value}\n"
            elif style == 1:
                body = f"{label.upper()} = {value}\n"
            elif style == 2:
                body = json.dumps({label: value}, ensure_ascii=False) + "\n"
            else:
                body = f"{label.lower()}: {value}\n"
            text = prefix + body + "Finding: No acute fracture.\nDose: 5 mg.\n"
            start = text.index(value)
            cases.append(
                {
                    "subject": f"{split}-template-{index % 18}-{style}",
                    "split": split,
                    "origin": "synthetic",
                    "text": text,
                    "identifiers": [
                        {"category": category, "start": start, "end": start + len(value)}
                    ],
                }
            )
        # Blanks/negative controls, and unlabeled contexts the rules cannot resolve.
        for index in range(30):
            text = f"Negative control {split} {index}\nNo acute fracture. Dose 5 mg. Pulse 72."
            cases.append(
                {
                    "subject": f"{split}-negative",
                    "split": split,
                    "origin": "synthetic",
                    "text": text,
                    "identifiers": [],
                }
            )
        for index in range(30):
            value = ["Robin Sample", "Taylor Example", "Sam O'Connor"][index % 3]
            text = f"Narrative challenge {split} {index}\nDiscussed care with {value} yesterday."
            start = text.index(value)
            cases.append(
                {
                    "subject": f"{split}-narrative-{index % 3}",
                    "split": split,
                    "origin": "synthetic",
                    "text": text,
                    "identifiers": [
                        {"category": "name", "start": start, "end": start + len(value)}
                    ],
                }
            )
    return {
        "schema": 1,
        "description": "Synthetic rule-regression corpus. Repeated templates are grouped, not independent clinical patients. Face/biometric entries are textual IDs only.",
        "cases": cases,
    }


if __name__ == "__main__":
    path = Path("output/records-corpus.json")
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(build(), ensure_ascii=False, indent=2))
    print("Wrote 840 synthetic regression records; no patient data.")
