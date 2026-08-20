from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from openrouter import SearchConfig


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = PROJECT_ROOT / "experiment.json"


class ConfigError(ValueError):
    """Raised when an experiment configuration is incomplete or invalid."""


@dataclass(frozen=True)
class ExperimentConfig:
    candidate_models: tuple[str, ...]
    judge_model: str
    case_count: int
    seed: int
    timeout_seconds: float
    reasoning_effort: str
    max_tool_calls: int
    search: SearchConfig


def load_config(path: Path, *, require_models: bool) -> ExperimentConfig:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ConfigError(f"Config not found: {path}") from error
    except json.JSONDecodeError as error:
        raise ConfigError(f"Config is not valid JSON: {path}") from error

    try:
        models = raw["candidate_models"]
        judge_model = raw["judge_model"]
        case_count = raw["case_count"]
        seed = raw["seed"]
        timeout_seconds = raw["timeout_seconds"]
        reasoning_effort = raw["reasoning_effort"]
        max_tool_calls = raw["max_tool_calls"]
        search_raw = raw["search"]
        search = SearchConfig(
            engine=search_raw["engine"],
            max_results=search_raw["max_results"],
        )
    except (KeyError, TypeError) as error:
        raise ConfigError(f"Config has a missing or invalid field: {error}") from error

    if not isinstance(models, list) or not all(
        isinstance(model, str) and model.strip() for model in models
    ):
        raise ConfigError("candidate_models must be a list of non-empty strings")
    if len(models) != len(set(models)):
        raise ConfigError("candidate_models contains a duplicate model")
    if not isinstance(judge_model, str):
        raise ConfigError("judge_model must be a string")
    if not isinstance(case_count, int) or isinstance(case_count, bool) or case_count < 1:
        raise ConfigError("case_count must be a positive integer")
    if not isinstance(seed, int) or isinstance(seed, bool):
        raise ConfigError("seed must be an integer")
    if not isinstance(timeout_seconds, (int, float)) or timeout_seconds <= 0:
        raise ConfigError("timeout_seconds must be greater than zero")
    allowed_efforts = {"minimal", "low", "medium", "high", "xhigh", "max"}
    if reasoning_effort not in allowed_efforts:
        allowed = ", ".join(sorted(allowed_efforts))
        raise ConfigError(f"reasoning_effort must be one of: {allowed}")
    if (
        not isinstance(max_tool_calls, int)
        or isinstance(max_tool_calls, bool)
        or not 1 <= max_tool_calls <= 30
    ):
        raise ConfigError("max_tool_calls must be an integer between 1 and 30")

    try:
        search.validate()
    except ValueError as error:
        raise ConfigError(str(error)) from error

    if require_models and not models:
        raise ConfigError(
            "No candidate models selected. Agree on the models before running."
        )
    if require_models and not judge_model.strip():
        raise ConfigError("No judge model selected. Agree on the judge before running.")

    return ExperimentConfig(
        candidate_models=tuple(models),
        judge_model=judge_model,
        case_count=case_count,
        seed=seed,
        timeout_seconds=float(timeout_seconds),
        reasoning_effort=reasoning_effort,
        max_tool_calls=max_tool_calls,
        search=search,
    )
