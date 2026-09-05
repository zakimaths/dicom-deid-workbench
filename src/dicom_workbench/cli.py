"""The UI and CLI call the same transformation engine."""

import argparse
import json
from pathlib import Path

from .core import MAX_BYTES, Unsupported, transform
from .fixtures import synthetic_dicom
from .server import serve


def write_new(path, content):
    # Exclusive creation prevents accidental replacement of input or an existing export.
    with Path(path).open("xb") as output:
        output.write(content)


def main():
    parser = argparse.ArgumentParser(description="Local DICOM metadata workbench (educational).")
    commands = parser.add_subparsers(dest="command", required=True)
    web = commands.add_parser("serve", help="Start the local browser interface")
    web.add_argument("--port", type=int, default=8765)
    fixture = commands.add_parser("fixture", help="Generate a deterministic synthetic DICOM")
    fixture.add_argument("output", type=Path)
    scrub = commands.add_parser("scrub", help="Scrub the supported metadata subset from one file")
    scrub.add_argument("input", type=Path)
    scrub.add_argument("output", type=Path)
    scrub.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "serve":
            serve(args.port)
        elif args.command == "fixture":
            write_new(args.output, synthetic_dicom())
            print("Synthetic fixture created.")
        else:
            if args.output.exists() or (args.report and args.report.exists()):
                raise Unsupported("An output already exists. Choose new output paths.")
            if args.report and args.report.resolve() in (
                args.input.resolve(),
                args.output.resolve(),
            ):
                raise Unsupported("Input, output and report must have different paths.")
            with args.input.open("rb") as source:
                result = transform(source.read(MAX_BYTES + 1))
            write_new(args.output, result.dicom)
            if args.report:
                write_new(args.report, json.dumps(result.report, indent=2).encode())
            print("Metadata scrubbed; pixels unchanged and not assessed. Not for clinical use.")
    except (Unsupported, OSError) as error:
        message = (
            str(error)
            if isinstance(error, Unsupported)
            else "Cannot access a file or start the service. Check paths, permissions and port."
        )
        parser.exit(1, f"{message}\n")


if __name__ == "__main__":
    main()
