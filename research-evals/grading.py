from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Mapping

from browsecomp import Case
from openrouter import OpenRouterClient


GRADER_TEMPLATE = """
Judge whether the following [response] to [question] is correct or not based on
the precise and unambiguous [correct_answer] below.

[question]: {question}

[response]: {response}

[correct_answer]: {correct_answer}

Extract the final exact answer from [response]. Use the string "None" if there
is no final answer. Explain whether it matches [correct_answer]. Do not solve
the question again. Only compare the two answers.
""".strip()


GRADE_RESPONSE_FORMAT: Mapping[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "browsecomp_grade",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "extracted_final_answer": {"type": "string"},
                "reasoning": {"type": "string"},
                "correct": {"type": "boolean"},
            },
            "required": ["extracted_final_answer", "reasoning", "correct"],
            "additionalProperties": False,
        },
    },
}


class GradingError(RuntimeError):
    """Raised when a judge response cannot be converted into a verdict."""


@dataclass(frozen=True)
class Grade:
    correct: bool
    judgement: str
    raw_response: Mapping[str, Any]


def parse_verdict(judgement: str) -> bool:
    try:
        parsed = json.loads(judgement)
    except json.JSONDecodeError as error:
        raise GradingError("Judge response is not valid JSON") from error

    if not isinstance(parsed, dict):
        raise GradingError("Judge response must be a JSON object")
    if not isinstance(parsed.get("extracted_final_answer"), str):
        raise GradingError("Judge response has an invalid extracted_final_answer")
    if not isinstance(parsed.get("reasoning"), str):
        raise GradingError("Judge response has invalid reasoning")
    if not isinstance(parsed.get("correct"), bool):
        raise GradingError("Judge response has an invalid correct verdict")
    return parsed["correct"]


def grade_answer(
    *,
    client: OpenRouterClient,
    judge_model: str,
    case: Case,
    candidate_answer: str,
) -> Grade:
    prompt = GRADER_TEMPLATE.format(
        question=case.question,
        response=candidate_answer,
        correct_answer=case.reference_answer,
    )
    completion = client.complete(
        model=judge_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format=GRADE_RESPONSE_FORMAT,
    )
    return Grade(
        correct=parse_verdict(completion.text),
        judgement=completion.text,
        raw_response=completion.raw_response,
    )
