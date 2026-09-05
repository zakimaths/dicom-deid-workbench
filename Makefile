.PHONY: setup run test reproduce
setup:
	uv sync --locked
run:
	uv run --locked dicom-workbench serve
test:
	uv run --locked pytest
	uv run --locked ruff check .
reproduce:
	uv run --locked python scripts/reproduce.py
