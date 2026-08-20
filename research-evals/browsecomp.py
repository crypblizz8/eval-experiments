from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_DATASET = PROJECT_ROOT / "data" / "browse_comp_test_set.csv"
DEFAULT_MANIFEST = PROJECT_ROOT / "dataset.lock.json"


class DatasetError(ValueError):
    """Raised when the local BrowseComp data does not match its contract."""


@dataclass(frozen=True)
class Case:
    case_id: str
    question: str
    reference_answer: str
    topic: str


def _derive_key(password: str, length: int) -> bytes:
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    repeats, remainder = divmod(length, len(digest))
    return digest * repeats + digest[:remainder]


def decrypt(value: str, canary: str) -> str:
    """Decode one value using the method in OpenAI's BrowseComp loader."""
    try:
        encrypted = base64.b64decode(value, validate=True)
        key = _derive_key(canary, len(encrypted))
        decrypted = bytes(left ^ right for left, right in zip(encrypted, key))
        return decrypted.decode("utf-8")
    except (binascii.Error, UnicodeDecodeError) as error:
        raise DatasetError("A BrowseComp value could not be decoded") from error


def _read_manifest(path: Path) -> dict[str, Any]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise DatasetError(f"Dataset manifest not found: {path}") from error
    except json.JSONDecodeError as error:
        raise DatasetError(f"Dataset manifest is not valid JSON: {path}") from error

    required = {"sha256", "rows", "columns"}
    missing = required.difference(manifest)
    if missing:
        names = ", ".join(sorted(missing))
        raise DatasetError(f"Dataset manifest is missing: {names}")

    if not isinstance(manifest["sha256"], str) or len(manifest["sha256"]) != 64:
        raise DatasetError("Dataset manifest has an invalid SHA-256 value")
    if not isinstance(manifest["rows"], int) or manifest["rows"] < 1:
        raise DatasetError("Dataset manifest has an invalid row count")
    if not isinstance(manifest["columns"], list) or not all(
        isinstance(column, str) for column in manifest["columns"]
    ):
        raise DatasetError("Dataset manifest has invalid columns")

    return manifest


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_cases(
    dataset_path: Path = DEFAULT_DATASET,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> list[Case]:
    """Verify, decode, and return all BrowseComp cases in source order."""
    manifest = _read_manifest(manifest_path)

    if not dataset_path.is_file():
        raise DatasetError(f"Dataset not found: {dataset_path}")

    actual_digest = _sha256(dataset_path)
    if actual_digest != manifest["sha256"]:
        raise DatasetError(
            "Dataset checksum does not match dataset.lock.json. "
            "Do not use a changed or partial download."
        )

    cases: list[Case] = []
    with dataset_path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames != manifest["columns"]:
            raise DatasetError(
                f"Dataset columns are {reader.fieldnames}; "
                f"expected {manifest['columns']}"
            )

        for row_number, row in enumerate(reader):
            canary = row["canary"]
            question = decrypt(row["problem"], canary).strip()
            reference_answer = decrypt(row["answer"], canary).strip()
            topic = row["problem_topic"].strip()

            if not question or not reference_answer:
                raise DatasetError(
                    f"BrowseComp row {row_number} has an empty question or answer"
                )

            cases.append(
                Case(
                    case_id=f"browsecomp-{row_number:04d}",
                    question=question,
                    reference_answer=reference_answer,
                    topic=topic,
                )
            )

    if len(cases) != manifest["rows"]:
        raise DatasetError(
            f"Dataset contains {len(cases)} rows; expected {manifest['rows']}"
        )

    return cases


def select_cases(cases: Sequence[Case], count: int, seed: int) -> list[Case]:
    """Select cases reproducibly without changing their source records."""
    if count < 1:
        raise DatasetError("Sample count must be at least 1")
    if count > len(cases):
        raise DatasetError(
            f"Cannot sample {count} cases from a dataset containing {len(cases)}"
        )

    return random.Random(seed).sample(list(cases), count)
