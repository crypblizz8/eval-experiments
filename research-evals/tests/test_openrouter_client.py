import json
from urllib.request import Request

import pytest

from openrouter import (
    OpenRouterClient,
    OpenRouterError,
    SearchConfig,
)


def test_research_sends_current_web_search_tool() -> None:
    captured: dict[str, object] = {}

    def fake_sender(request: Request, timeout: float) -> dict[str, object]:
        captured["payload"] = json.loads(request.data or b"{}")
        captured["timeout"] = timeout
        return {
            "choices": [
                {"message": {"content": "Exact Answer: Example\nConfidence: 50%"}}
            ],
            "usage": {"server_tool_use": {"web_search_requests": 2}},
        }

    client = OpenRouterClient("test-key", timeout_seconds=30, sender=fake_sender)
    completion = client.research(
        model="provider/model",
        question="What is the answer?",
        search=SearchConfig(engine="exa", max_results=5),
        reasoning_effort="high",
        max_tool_calls=5,
    )

    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["model"] == "provider/model"
    assert payload["tools"] == [
        {
            "type": "openrouter:web_search",
            "parameters": {
                "engine": "exa",
                "max_results": 5,
            },
        }
    ]
    assert payload["reasoning"] == {"effort": "high"}
    assert payload["parallel_tool_calls"] is False
    assert payload["stop_server_tools_when"] == [
        {"type": "step_count_is", "step_count": 5}
    ]
    assert captured["timeout"] == 30
    assert completion.text.startswith("Exact Answer:")


def test_complete_rejects_malformed_response() -> None:
    def fake_sender(request: Request, timeout: float) -> dict[str, object]:
        return {"choices": []}

    client = OpenRouterClient("test-key", timeout_seconds=30, sender=fake_sender)

    with pytest.raises(OpenRouterError, match="missing"):
        client.complete(
            model="provider/model",
            messages=[{"role": "user", "content": "question"}],
        )


def test_complete_sends_temperature_and_response_format() -> None:
    captured: dict[str, object] = {}

    def fake_sender(request: Request, timeout: float) -> dict[str, object]:
        captured["payload"] = json.loads(request.data or b"{}")
        return {"choices": [{"message": {"content": '{"correct":true}'}}]}

    client = OpenRouterClient("test-key", timeout_seconds=30, sender=fake_sender)
    response_format = {
        "type": "json_schema",
        "json_schema": {"name": "grade", "strict": True, "schema": {}},
    }
    client.complete(
        model="judge/model",
        messages=[{"role": "user", "content": "grade this"}],
        temperature=0,
        response_format=response_format,
    )

    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["temperature"] == 0
    assert payload["response_format"] == response_format


def test_search_config_rejects_invalid_result_count() -> None:
    search = SearchConfig(engine="exa", max_results=0)

    with pytest.raises(ValueError, match="between 1 and 25"):
        search.validate()
