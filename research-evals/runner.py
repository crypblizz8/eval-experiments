from __future__ import annotations

import json
import time
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping

from browsecomp import load_cases, select_cases
from config import ExperimentConfig
from grading import GradingError, grade_answer
from openrouter import OpenRouterClient, OpenRouterError


DEFAULT_RUNS_DIR = Path(__file__).resolve().parent / "runs"


def _write_jsonl(file: Any, record: Mapping[str, Any]) -> None:
    file.write(json.dumps(record, ensure_ascii=False) + "\n")
    file.flush()


def _create_run_directory(root: Path) -> Path:
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    path = root / run_id
    path.mkdir(parents=True, exist_ok=False)
    return path


def run_experiment(
    *,
    config: ExperimentConfig,
    client: OpenRouterClient,
    runs_dir: Path = DEFAULT_RUNS_DIR,
) -> Path:
    cases = select_cases(load_cases(), config.case_count, config.seed)
    run_dir = _create_run_directory(runs_dir)

    config_record = {
        "created_at": datetime.now(UTC).isoformat(),
        "candidate_models": list(config.candidate_models),
        "judge_model": config.judge_model,
        "case_count": config.case_count,
        "seed": config.seed,
        "timeout_seconds": config.timeout_seconds,
        "reasoning_effort": config.reasoning_effort,
        "max_tool_calls": config.max_tool_calls,
        "search": asdict(config.search),
        "case_ids": [case.case_id for case in cases],
    }
    (run_dir / "config.json").write_text(
        json.dumps(config_record, indent=2) + "\n",
        encoding="utf-8",
    )

    counts = {
        model: {
            "attempted": 0,
            "correct": 0,
            "candidate_failures": 0,
            "grading_failures": 0,
        }
        for model in config.candidate_models
    }

    with (
        (run_dir / "attempts.jsonl").open("w", encoding="utf-8") as attempts_file,
        (run_dir / "grades.jsonl").open("w", encoding="utf-8") as grades_file,
    ):
        for model in config.candidate_models:
            for case in cases:
                counts[model]["attempted"] += 1
                started = time.perf_counter()
                try:
                    completion = client.research(
                        model=model,
                        question=case.question,
                        search=config.search,
                        reasoning_effort=config.reasoning_effort,
                        max_tool_calls=config.max_tool_calls,
                    )
                except OpenRouterError as error:
                    counts[model]["candidate_failures"] += 1
                    _write_jsonl(
                        attempts_file,
                        {
                            "case_id": case.case_id,
                            "model": model,
                            "status": "error",
                            "latency_seconds": time.perf_counter() - started,
                            "error": str(error),
                        },
                    )
                    _write_jsonl(
                        grades_file,
                        {
                            "case_id": case.case_id,
                            "model": model,
                            "status": "not_graded",
                            "correct": False,
                            "reason": "candidate_error",
                        },
                    )
                    continue

                _write_jsonl(
                    attempts_file,
                    {
                        "case_id": case.case_id,
                        "model": model,
                        "status": "completed",
                        "latency_seconds": time.perf_counter() - started,
                        "answer": completion.text,
                        "raw_response": completion.raw_response,
                    },
                )

                try:
                    grade = grade_answer(
                        client=client,
                        judge_model=config.judge_model,
                        case=case,
                        candidate_answer=completion.text,
                    )
                except (OpenRouterError, GradingError) as error:
                    counts[model]["grading_failures"] += 1
                    _write_jsonl(
                        grades_file,
                        {
                            "case_id": case.case_id,
                            "model": model,
                            "status": "error",
                            "correct": False,
                            "error": str(error),
                        },
                    )
                    continue

                counts[model]["correct"] += int(grade.correct)
                _write_jsonl(
                    grades_file,
                    {
                        "case_id": case.case_id,
                        "model": model,
                        "status": "completed",
                        "correct": grade.correct,
                        "judgement": grade.judgement,
                        "raw_response": grade.raw_response,
                    },
                )

    summary = {
        "models": {
            model: {
                **model_counts,
                "accuracy": model_counts["correct"] / model_counts["attempted"],
            }
            for model, model_counts in counts.items()
        }
    }
    (run_dir / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )
    return run_dir
