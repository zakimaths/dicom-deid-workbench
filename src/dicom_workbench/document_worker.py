"""Private parser subprocess. No original filenames, filesystem output or stderr."""

import json
import os
import resource
import sys


def main():
    # Keep optional numeric-library imports inside the parser resource budget.
    for key in (
        "OPENBLAS_NUM_THREADS",
        "OMP_NUM_THREADS",
        "MKL_NUM_THREADS",
        "NUMEXPR_NUM_THREADS",
    ):
        os.environ[key] = "1"
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
    # Linux has an address-space hard limit. macOS uses the parent's RSS watchdog.
    if sys.platform != "darwin":
        resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    from .documents import extract
    from .core import MAX_BYTES

    try:
        result = extract(sys.stdin.buffer.read(MAX_BYTES + 1), sys.argv[1])
        sys.stdout.write(json.dumps(result, ensure_ascii=True))
    except Exception:
        sys.exit(1)


if __name__ == "__main__":
    main()
