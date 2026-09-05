"""Evaluate an authorised local annotated corpus. Emits counts, never text or subject IDs."""

import argparse
import json
from pathlib import Path
from dicom_workbench.evaluation import evaluate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    try:
        with args.corpus.open("rb") as source:
            raw = source.read(32 * 1024 * 1024 + 1)
        if len(raw) > 32 * 1024 * 1024:
            raise ValueError()
        report = evaluate(json.loads(raw))
        with args.report.open("x") as target:
            json.dump(report, target, indent=2)
    except Exception:
        parser.exit(
            1,
            "Evaluation failed. Check the corpus schema, split separation and a new report path.\n",
        )
    for split in report["reports"]:
        print(
            json.dumps(
                {
                    "split": split["split"],
                    "records": split["records"],
                    "recall": split["identifier_recall"],
                    "failures": split["record_failure_rate"],
                }
            )
        )


if __name__ == "__main__":
    main()
