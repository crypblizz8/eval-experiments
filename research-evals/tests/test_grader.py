from browsecomp import Case
from grading import GradingError, grade_answer, parse_verdict
from openrouter import Completion


class FakeClient:
    def __init__(self, judgement: str) -> None:
        self.judgement = judgement
        self.tools = object()
        self.temperature = object()
        self.response_format = None

    def complete(self, **kwargs: object) -> Completion:
        self.tools = kwargs.get("tools")
        self.temperature = kwargs.get("temperature")
        self.response_format = kwargs.get("response_format")
        return Completion(
            text=self.judgement,
            raw_response={"choices": [{"message": {"content": self.judgement}}]},
        )


def test_parse_verdict_reads_json_boolean() -> None:
    assert parse_verdict(
        '{"extracted_final_answer":"A","reasoning":"same","correct":true}'
    ) is True
    assert parse_verdict(
        '{"extracted_final_answer":"B","reasoning":"different","correct":false}'
    ) is False


def test_parse_verdict_rejects_missing_value() -> None:
    try:
        parse_verdict("I think it is correct")
    except GradingError as error:
        assert "valid JSON" in str(error)
    else:
        raise AssertionError("Missing verdict should fail")


def test_grade_does_not_give_the_judge_web_search() -> None:
    client = FakeClient(
        '{"extracted_final_answer":"Answer","reasoning":"same","correct":true}'
    )
    case = Case("case-1", "Question?", "Answer", "topic")

    grade = grade_answer(
        client=client,  # type: ignore[arg-type]
        judge_model="judge/model",
        case=case,
        candidate_answer="Exact Answer: Answer",
    )

    assert grade.correct is True
    assert client.tools is None
    assert client.temperature == 0
    assert isinstance(client.response_format, dict)
    assert client.response_format["type"] == "json_schema"
