"""Compare two models on a tiny, deterministic sentiment dataset."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import APIStatusError, OpenAI

PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_CASES_PATH = PROJECT_DIR / "cases.jsonl"
OUTPUT_DIR = PROJECT_DIR / "outputs"
DEFAULT_MODELS = [
    "openai/gpt-5.5",
    "anthropic/claude-sonnet-5",
]
VALID_LABELS = {"positive", "negative", "neutral"}


def create_client() -> OpenAI:
    """Create an OpenRouter client after validating local credentials."""
    load_dotenv(PROJECT_DIR / ".env")
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENROUTER_API_KEY is not configured; copy .env.example to .env"
        )
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        max_retries=0,
    )


def load_cases(path: Path) -> list[dict[str, str]]:
    """Load and validate sentiment cases from JSONL."""
    if not path.exists():
        raise ValueError(f"cases file does not exist: {path}")

    cases: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for line_number, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid JSON on line {line_number}: {error}") from error

        case_id = value.get("id")
        text = value.get("text")
        expected = value.get("expected")
        if not isinstance(case_id, str) or not case_id.strip():
            raise ValueError(f"line {line_number}: id must be a non-empty string")
        if case_id in seen_ids:
            raise ValueError(f"line {line_number}: duplicate id {case_id!r}")
        if not isinstance(text, str) or not text.strip():
            raise ValueError(f"line {line_number}: text must be a non-empty string")
        if expected not in VALID_LABELS:
            raise ValueError(
                f"line {line_number}: expected must be one of {sorted(VALID_LABELS)}"
            )

        cases.append({"id": case_id, "text": text, "expected": expected})
        seen_ids.add(case_id)

    if not cases:
        raise ValueError("cases file contains no cases")
    return cases


def build_prompt(text: str) -> str:
    """Build the same constrained classification prompt for every model."""
    return (
        "Classify the sentiment of the text as positive, negative, or neutral.\n"
        "Positive means the overall opinion is favorable. Negative means the "
        "overall opinion is unfavorable. Neutral means no approval or "
        "disapproval is expressed.\n"
        "Return only one label: positive, negative, or neutral.\n\n"
        f"Text: {text}"
    )


def normalize_label(response: str) -> str:
    """Normalize superficial casing and whitespace without guessing intent."""
    return response.strip().lower()


def classify(*, client: OpenAI, model: str, text: str) -> tuple[str, dict[str, Any]]:
    """Request one sentiment label and return it with basic response metadata."""
    response = client.chat.completions.create(
        model=model,
        max_tokens=10,
        messages=[{"role": "user", "content": build_prompt(text)}],
        extra_body={"reasoning": {"effort": "none"}},
    )
    message = response.choices[0].message
    raw_response = message.content or ""
    if not raw_response.strip():
        raise ValueError("model returned empty content")

    usage = response.usage
    metadata = {
        "request_id": response.id,
        "response_model": response.model,
        "finish_reason": response.choices[0].finish_reason,
        "prompt_tokens": getattr(usage, "prompt_tokens", None),
        "completion_tokens": getattr(usage, "completion_tokens", None),
    }
    return raw_response, metadata


def run_eval(
    model: str,
    cases: list[dict[str, str]],
    *,
    output_dir: Path = OUTPUT_DIR,
    client: OpenAI | None = None,
) -> dict[str, int | float | str]:
    """Classify every case, score exact labels, and save inspectable results."""
    active_client = client or create_client()
    records: list[dict[str, Any]] = []

    for case in cases:
        record: dict[str, Any] = {
            "id": case["id"],
            "text": case["text"],
            "expected": case["expected"],
            "raw_response": None,
            "actual": None,
            "passed": False,
            "error": None,
        }
        try:
            raw_response, metadata = classify(
                client=active_client,
                model=model,
                text=case["text"],
            )
            actual = normalize_label(raw_response)
            record.update(
                {
                    "raw_response": raw_response,
                    "actual": actual,
                    "passed": actual == case["expected"],
                    **metadata,
                }
            )
            marker = "✓" if record["passed"] else "✗"
            print(
                f"{marker} {case['id']}: expected={case['expected']} actual={actual}",
                flush=True,
            )
        except APIStatusError as error:
            record["error"] = f"APIStatusError {error.status_code}: {error}"
            print(f"✗ {case['id']}: {record['error']}", flush=True)
            records.append(record)
            if error.status_code in {400, 401, 402, 403, 404, 429}:
                print(f"Stopping {model} after API status {error.status_code}.")
                break
            continue
        except Exception as error:
            record["error"] = f"{type(error).__name__}: {error}"
            print(f"✗ {case['id']}: {record['error']}", flush=True)
        records.append(record)

    output_dir.mkdir(parents=True, exist_ok=True)
    safe_model = model.replace("/", "_")
    results_path = output_dir / f"sentiment_{safe_model}.jsonl"
    with results_path.open("w", encoding="utf-8") as file:
        for record in records:
            file.write(json.dumps(record, sort_keys=True) + "\n")

    passed = sum(record["passed"] is True for record in records)
    errors = sum(record["error"] is not None for record in records)
    total = len(cases)
    accuracy = passed / total
    print(
        f"\n{model} — accuracy: {accuracy:.1%} ({passed}/{total}), "
        f"errors: {errors}",
        flush=True,
    )
    return {
        "model": model,
        "accuracy": accuracy,
        "passed": passed,
        "total": total,
        "completed": len(records),
        "errors": errors,
        "results_path": str(results_path),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        action="append",
        dest="models",
        help="OpenRouter model id. Repeat to compare multiple models.",
    )
    parser.add_argument(
        "--cases",
        type=Path,
        default=DEFAULT_CASES_PATH,
        help="Path to the sentiment JSONL dataset.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Run only the first N cases for a smaller paid smoke test.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    models = args.models or DEFAULT_MODELS

    try:
        cases = load_cases(args.cases)
        if args.limit is not None:
            if args.limit < 1:
                raise ValueError("limit must be at least 1")
            cases = cases[: args.limit]
        client = create_client()
        summaries = [run_eval(model, cases, client=client) for model in models]
    except ValueError as error:
        raise SystemExit(f"error: {error}") from error

    print("\n=== RESULTS ===")
    for summary in summaries:
        print(
            f"{summary['model']:42s} accuracy: {summary['accuracy']:.1%} "
            f"({summary['passed']}/{summary['total']})"
        )


if __name__ == "__main__":
    main()
