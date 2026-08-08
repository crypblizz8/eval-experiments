import json
import tempfile
import unittest
from pathlib import Path

import eval as eval_runner


class SimpleEvalTests(unittest.TestCase):
    def test_default_models_are_fixed_and_reproducible(self) -> None:
        self.assertEqual(
            eval_runner.DEFAULT_MODELS,
            ["openai/gpt-5.5", "anthropic/claude-sonnet-5"],
        )

    def test_normalize_label_only_changes_case_and_whitespace(self) -> None:
        self.assertEqual(eval_runner.normalize_label("  Positive\n"), "positive")
        self.assertEqual(eval_runner.normalize_label("positive."), "positive.")

    def test_build_prompt_defines_every_valid_label(self) -> None:
        prompt = eval_runner.build_prompt("A test sentence")
        for label in eval_runner.VALID_LABELS:
            self.assertIn(label, prompt)
        self.assertIn("A test sentence", prompt)

    def test_loads_valid_cases(self) -> None:
        cases = eval_runner.load_cases(eval_runner.DEFAULT_CASES_PATH)
        self.assertEqual(len(cases), 20)
        self.assertEqual({case["expected"] for case in cases}, eval_runner.VALID_LABELS)

    def test_rejects_duplicate_ids(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cases.jsonl"
            row = {"id": "same", "text": "Text", "expected": "neutral"}
            path.write_text(
                json.dumps(row) + "\n" + json.dumps(row) + "\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "duplicate id"):
                eval_runner.load_cases(path)

    def test_rejects_unknown_label(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cases.jsonl"
            path.write_text(
                json.dumps({"id": "1", "text": "Text", "expected": "mixed"}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "expected must be one of"):
                eval_runner.load_cases(path)


if __name__ == "__main__":
    unittest.main()
