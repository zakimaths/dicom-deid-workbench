"""The UI and CLI call the same transformation engine."""

import argparse
import json
from pathlib import Path

from .selection import load_selection
from .core import MAX_BYTES, Unsupported, transform
from .fixtures import synthetic_dicom
from .collection import transform_collection
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
    fixture.add_argument("--with-text", action="store_true", help="Plant a fake ID in the pixels")
    scrub = commands.add_parser("scrub", help="Scrub the supported metadata subset from one file")
    scrub.add_argument("input", type=Path)
    scrub.add_argument("output", type=Path)
    scrub.add_argument("--report", type=Path)
    scrub.add_argument(
        "--regions", type=Path, help="JSON array of rectangular pixel regions to erase"
    )
    collection = commands.add_parser(
        "scrub-collection",
        help="Scrub up to 16 supported files from one study with consistent identifiers",
    )
    collection.add_argument("output_directory", type=Path)
    collection.add_argument("inputs", type=Path, nargs="+")
    args = parser.parse_args()
    try:
        if args.command == "serve":
            serve(args.port)
        elif args.command == "fixture":
            write_new(args.output, synthetic_dicom(with_text=args.with_text))
            print("Synthetic fixture created.")
        elif args.command == "scrub-collection":
            if args.output_directory.exists() or not 1 <= len(args.inputs) <= 16:
                raise Unsupported("Choose a new output directory and 1 to 16 source files.")
            files = []
            for path in args.inputs:
                with path.open("rb") as source:
                    files.append(source.read(MAX_BYTES + 1))
            results = transform_collection(files)
            args.output_directory.mkdir()
            for index, result in enumerate(results, 1):
                write_new(args.output_directory / f"image-{index:04d}.dcm", result.dicom)
            write_new(
                args.output_directory / "report.json",
                json.dumps(
                    {
                        "schema": 1,
                        "files": [r.report for r in results],
                        "notice": "Metadata subset only; sequence references unsupported; pixels unassessed.",
                    },
                    indent=2,
                ).encode(),
            )
            print(
                "Collection written with consistent study, series and frame identifiers. Pixels remain unassessed."
            )
        else:
            if args.output.exists() or (args.report and args.report.exists()):
                raise Unsupported("An output already exists. Choose new output paths.")
            if args.report and args.report.resolve() in (
                args.input.resolve(),
                args.output.resolve(),
            ):
                raise Unsupported("Input, output and report must have different paths.")
            with args.input.open("rb") as source:
                regions = None
                if args.regions:
                    with args.regions.open("rb") as selection:
                        raw = selection.read(8193)
                    if len(raw) > 8192:
                        raise Unsupported("The region selection is too large.")
                    try:
                        regions = load_selection(raw)
                    except (ValueError, UnicodeError):
                        raise Unsupported("The region file must contain a JSON array.") from None
                    if regions is None:
                        raise Unsupported("The region file must contain a non-empty JSON array.")
                result = transform(source.read(MAX_BYTES + 1), regions=regions)
            write_new(args.output, result.dicom)
            if args.report:
                write_new(args.report, json.dumps(result.report, indent=2).encode())
            print(result.report["notice"])
    except (Unsupported, OSError) as error:
        message = (
            str(error)
            if isinstance(error, Unsupported)
            else "Cannot access a file or start the service. Check paths, permissions and port."
        )
        parser.exit(1, f"{message}\n")


if __name__ == "__main__":
    main()
