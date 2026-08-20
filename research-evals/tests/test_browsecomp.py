import base64
import csv
import hashlib
import json
from pathlib import Path

import pytest

from browsecomp import Case, DatasetError, load_cases, select_cases


def _encrypt(value: str, canary: str) -> str:
    raw = value.encode("utf-8")
    digest = hashlib.sha256(canary.encode("utf-8")).digest()
    repeats, remainder = divmod(len(raw), len(digest))
    key = digest * repeats + digest[:remainder]
    encrypted = bytes(left ^ right for left, right in zip(raw, key))
    return base64.b64encode(encrypted).decode("ascii")


def _write_fixture(directory: Path) -> tuple[Path, Path]:
    dataset_path = directory / "cases.csv"
    rows = [
        {
            "problem": _encrypt("First question?", "alpha"),
            "answer": _encrypt("First answer", "alpha"),
            "problem_topic": "one",
            "canary": "alpha",
        },
        {
            "problem": _encrypt("Second question?", "beta"),
            "answer": _encrypt("Second answer", "beta"),
            "problem_topic": "two",
            "canary": "beta",
        },
    ]

    with dataset_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    manifest_path = directory / "dataset.lock.json"
    manifest_path.write_text(
        json.dumps(
            {
                "sha256": hashlib.sha256(dataset_path.read_bytes()).hexdigest(),
                "rows": 2,
                "columns": list(rows[0]),
            }
        ),
        encoding="utf-8",
    )
    return dataset_path, manifest_path


def test_load_cases_verifies_and_decodes_fixture(tmp_path: Path) -> None:
    dataset_path, manifest_path = _write_fixture(tmp_path)

    cases = load_cases(dataset_path, manifest_path)

    assert cases == [
        Case("browsecomp-0000", "First question?", "First answer", "one"),
        Case("browsecomp-0001", "Second question?", "Second answer", "two"),
    ]


def test_load_cases_rejects_changed_dataset(tmp_path: Path) -> None:
    dataset_path, manifest_path = _write_fixture(tmp_path)
    dataset_path.write_text("changed", encoding="utf-8")

    with pytest.raises(DatasetError, match="checksum"):
        load_cases(dataset_path, manifest_path)


def test_select_cases_is_reproducible() -> None:
    cases = [Case(f"case-{index}", "question", "answer", "") for index in range(10)]

    first = select_cases(cases, count=5, seed=0)
    second = select_cases(cases, count=5, seed=0)

    assert first == second
    assert len({case.case_id for case in first}) == 5


def test_select_cases_rejects_invalid_count() -> None:
    cases = [Case("case-0", "question", "answer", "")]

    with pytest.raises(DatasetError, match="at least 1"):
        select_cases(cases, count=0, seed=0)

    with pytest.raises(DatasetError, match="Cannot sample"):
        select_cases(cases, count=2, seed=0)
