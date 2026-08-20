from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

QUERY_TEMPLATE = """
{question}

Your response should be in the following format:

Explanation: {{your explanation for your final answer}}
Exact Answer: {{your succinct, final answer}}
Confidence: {{your confidence score between 0% and 100% for your answer}}
""".strip()


class OpenRouterError(RuntimeError):
    """Raised when OpenRouter does not return a usable completion."""


@dataclass(frozen=True)
class SearchConfig:
    engine: str
    max_results: int

    def validate(self) -> None:
        allowed_engines = {"auto", "native", "exa", "parallel", "perplexity"}
        if self.engine not in allowed_engines:
            allowed = ", ".join(sorted(allowed_engines))
            raise ValueError(f"Search engine must be one of: {allowed}")
        if not 1 <= self.max_results <= 25:
            raise ValueError("max_results must be between 1 and 25")


@dataclass(frozen=True)
class Completion:
    text: str
    raw_response: Mapping[str, Any]


Sender = Callable[[Request, float], Mapping[str, Any]]


def _send_json(request: Request, timeout: float) -> Mapping[str, Any]:
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise OpenRouterError(
            f"OpenRouter returned HTTP {error.code}: {body[:500]}"
        ) from error
    except URLError as error:
        raise OpenRouterError(f"OpenRouter request failed: {error.reason}") from error

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as error:
        raise OpenRouterError("OpenRouter returned invalid JSON") from error

    if not isinstance(parsed, dict):
        raise OpenRouterError("OpenRouter returned a non-object JSON response")
    return parsed


class OpenRouterClient:
    def __init__(
        self,
        api_key: str,
        timeout_seconds: float,
        sender: Sender = _send_json,
    ) -> None:
        if not api_key.strip():
            raise ValueError("OPENROUTER_API_KEY is empty")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be greater than zero")

        self._api_key = api_key
        self._timeout_seconds = timeout_seconds
        self._sender = sender

    def complete(
        self,
        *,
        model: str,
        messages: Sequence[Mapping[str, str]],
        tools: Sequence[Mapping[str, Any]] | None = None,
        reasoning_effort: str | None = None,
        max_tool_calls: int | None = None,
        temperature: float | None = None,
        response_format: Mapping[str, Any] | None = None,
    ) -> Completion:
        if not model.strip():
            raise ValueError("OpenRouter model is empty")
        if not messages:
            raise ValueError("OpenRouter messages are empty")

        payload: dict[str, Any] = {
            "model": model,
            "messages": list(messages),
        }
        if tools:
            payload["tools"] = list(tools)
        if reasoning_effort:
            payload["reasoning"] = {"effort": reasoning_effort}
        if max_tool_calls is not None:
            payload["parallel_tool_calls"] = False
            payload["stop_server_tools_when"] = [
                {"type": "step_count_is", "step_count": max_tool_calls}
            ]
        if temperature is not None:
            payload["temperature"] = temperature
        if response_format is not None:
            payload["response_format"] = dict(response_format)

        request = Request(
            OPENROUTER_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        response = self._sender(request, self._timeout_seconds)

        try:
            text = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise OpenRouterError(
                "OpenRouter response is missing choices[0].message.content"
            ) from error

        if not isinstance(text, str) or not text.strip():
            raise OpenRouterError("OpenRouter returned an empty answer")

        return Completion(text=text, raw_response=response)

    def research(
        self,
        *,
        model: str,
        question: str,
        search: SearchConfig,
        reasoning_effort: str,
        max_tool_calls: int,
    ) -> Completion:
        if not question.strip():
            raise ValueError("BrowseComp question is empty")
        search.validate()

        tool = {
            "type": "openrouter:web_search",
            "parameters": {
                "engine": search.engine,
                "max_results": search.max_results,
            },
        }
        return self.complete(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": QUERY_TEMPLATE.format(question=question),
                }
            ],
            tools=[tool],
            reasoning_effort=reasoning_effort,
            max_tool_calls=max_tool_calls,
        )
