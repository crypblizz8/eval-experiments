from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Sequence

from browsecomp import DatasetError, load_cases, select_cases
from config import (
    DEFAULT_CONFIG,
    ConfigError,
    load_config,
)
from openrouter import OpenRouterClient
from runner import run_experiment


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the BrowseComp learning eval.")
    commands = parser.add_subparsers(dest="command", required=True)

    check = commands.add_parser("check", help="Check data and config.")
    check.add_argument("--config", type=Path, default=DEFAULT_CONFIG)

    sample = commands.add_parser(
        "sample", help="Show sampled questions without reference answers."
    )
    sample.add_argument("--count", type=int, default=5)
    sample.add_argument("--seed", type=int, default=0)

    run = commands.add_parser("run", help="Run the live evaluation.")
    run.add_argument("--config", type=Path, default=DEFAULT_CONFIG)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        if args.command == "check":
            config = load_config(args.config, require_models=False)
            cases = load_cases()
            print(f"Dataset: ready ({len(cases)} cases)")
            model_count = len(config.candidate_models)
            model_status = f"{model_count} selected" if model_count else "not selected"
            print(f"Candidate models: {model_status}")
            print(f"Judge model: {config.judge_model or 'not selected'}")
            print("Live API call: not made")
            return 0

        if args.command == "sample":
            cases = select_cases(load_cases(), args.count, args.seed)
            print(f"Selected {len(cases)} cases with seed {args.seed}.")
            print("Reference answers are hidden.\n")
            for case in cases:
                print(case.case_id)
                print(case.question)
                print()
            return 0

        config = load_config(args.config, require_models=True)
        api_key = os.environ.get("OPENROUTER_API_KEY", "")
        if not api_key:
            raise ConfigError("OPENROUTER_API_KEY is not set")

        client = OpenRouterClient(api_key, config.timeout_seconds)
        run_dir = run_experiment(config=config, client=client)
        print(f"Run complete: {run_dir}")
        return 0
    except (ConfigError, DatasetError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
