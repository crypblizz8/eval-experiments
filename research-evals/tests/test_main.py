import json
from pathlib import Path

import pytest

import runner
from browsecomp import Case
from config import ConfigError, ExperimentConfig, load_config
from openrouter import Completion, SearchConfig
from runner import run_experiment


def _write_config(path: Path, *, models: list[str], judge: str) -> None:
    path.write_text(
        json.dumps(
            {
                "candidate_models": models,
                "judge_model": judge,
                "case_count": 5,
                "seed": 0,
                "timeout_seconds": 300,
                "reasoning_effort": "high",
                "max_tool_calls": 5,
                "search": {
                    "engine": "exa",
                    "max_results": 5,
                },
            }
        ),
        encoding="utf-8",
    )


def test_live_config_requires_agreed_models(tmp_path: Path) -> None:
    path = tmp_path / "experiment.json"
    _write_config(path, models=[], judge="")

    with pytest.raises(ConfigError, match="No candidate models"):
        load_config(path, require_models=True)


def test_complete_live_config_loads(tmp_path: Path) -> None:
    path = tmp_path / "experiment.json"
    _write_config(path, models=["provider/model"], judge="judge/model")

    config = load_config(path, require_models=True)

    assert config.candidate_models == ("provider/model",)
    assert config.judge_model == "judge/model"
    assert config.reasoning_effort == "high"
    assert config.max_tool_calls == 5


class FakeOpenRouterClient:
    def research(self, **kwargs: object) -> Completion:
        return Completion(
            text="Explanation: found it\nExact Answer: Answer\nConfidence: 90%",
            raw_response={"choices": [{"message": {"content": "Answer"}}]},
        )

    def complete(self, **kwargs: object) -> Completion:
        judgement = (
            '{"extracted_final_answer":"Answer",'
            '"reasoning":"same","correct":true}'
        )
        return Completion(
            text=judgement,
            raw_response={"choices": [{"message": {"content": judgement}}]},
        )


def test_offline_run_writes_attempt_grade_and_summary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        runner,
        "load_cases",
        lambda: [Case("browsecomp-0000", "Question?", "Answer", "topic")],
    )
    config = ExperimentConfig(
        candidate_models=("provider/model",),
        judge_model="judge/model",
        case_count=1,
        seed=0,
        timeout_seconds=30,
        reasoning_effort="high",
        max_tool_calls=5,
        search=SearchConfig(engine="exa", max_results=5),
    )

    run_dir = run_experiment(
        config=config,
        client=FakeOpenRouterClient(),  # type: ignore[arg-type]
        runs_dir=tmp_path,
    )

    assert (run_dir / "config.json").is_file()
    assert (run_dir / "attempts.jsonl").is_file()
    assert (run_dir / "grades.jsonl").is_file()
    summary = json.loads((run_dir / "summary.json").read_text(encoding="utf-8"))
    assert summary["models"]["provider/model"]["attempted"] == 1
    assert summary["models"]["provider/model"]["correct"] == 1
    assert summary["models"]["provider/model"]["accuracy"] == 1.0
