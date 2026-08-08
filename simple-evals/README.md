# Simple Evals

The smallest useful example of comparing two language models on a fixed
dataset.

This experiment asks GPT-5.5 and Claude Sonnet 5 to classify 20 short product
sentences as `positive`, `negative`, or `neutral`. A deterministic exact-match
scorer calculates accuracy.

```text
cases.jsonl → model response → normalize label → exact match → accuracy
```

## Models

- `openai/gpt-5.5`
- `anthropic/claude-sonnet-5`

The model IDs are pinned rather than using “latest” aliases so a later run does
not silently evaluate different models. Optional reasoning is disabled because
this task only needs a single label.

## Dataset

[`cases.jsonl`](cases.jsonl) contains 20 local examples:

- 7 positive
- 7 negative
- 6 neutral

Some reviews contain contrasting clauses such as “looks nice, but unusable,”
while neutral cases contain facts without approval or disapproval.

## Setup

```bash
cp .env.example .env
```

Add your OpenRouter key, then install dependencies:

```bash
uv sync
```

## Run

Run all 20 cases against both models:

```bash
uv run python eval.py
```

Preview the workflow with two paid calls per model:

```bash
uv run python eval.py --limit 2
```

You can also override the models or dataset:

```bash
uv run python eval.py \
  --model openai/gpt-5.5 \
  --cases cases.jsonl
```

Results are printed to the terminal and saved as inspectable JSONL files under
`outputs/`.


Expected Output:
```
Running test suites...
100%|████████████████████████████████████████████████████████████████████████████████████████████████| 20/20 [00:04<00:00,  4.95it/s]
Writing results to /Users/tomterado/Documents/Code/ai-learning/eval-experiments/simple-evals/outputs/samples_qwen_qwen3-coder-30b-a3b-instruct.jsonl_results.jsonl...
100%|█████████████████████████████████████████████████████████████████████████████████████████████| 20/20 [00:00<00:00, 45664.71it/s]

qwen/qwen3-coder-30b-a3b-instruct — pass@1: 0.0% (20/20 samples)

=== RESULTS ===
openai/gpt-5.5                                     pass@1: 100.0%
qwen/qwen3-coder-30b-a3b-instruct                  pass@1: 0.0%
tomterado@tterado simple-evals % clear
tomterado@tterado simple-evals %  uv run python eval.py
✓ review-01: expected=positive actual=positive
✓ review-02: expected=positive actual=positive
✓ review-03: expected=positive actual=positive
✓ review-04: expected=positive actual=positive
✓ review-05: expected=positive actual=positive
✓ review-06: expected=positive actual=positive
✓ review-07: expected=positive actual=positive
✓ review-08: expected=negative actual=negative
✓ review-09: expected=negative actual=negative
✓ review-10: expected=negative actual=negative
✓ review-11: expected=negative actual=negative
✓ review-12: expected=negative actual=negative
✓ review-13: expected=negative actual=negative
✓ review-14: expected=negative actual=negative
✓ review-15: expected=neutral actual=neutral
✓ review-16: expected=neutral actual=neutral
✓ review-17: expected=neutral actual=neutral
✓ review-18: expected=neutral actual=neutral
✓ review-19: expected=neutral actual=neutral
✓ review-20: expected=neutral actual=neutral

openai/gpt-5.5 — accuracy: 100.0% (20/20), errors: 0
✗ review-01: expected=positive actual=**positive**
✓ review-02: expected=positive actual=positive
✓ review-03: expected=positive actual=positive
✓ review-04: expected=positive actual=positive
✓ review-05: expected=positive actual=positive
✓ review-06: expected=positive actual=positive
✓ review-07: expected=positive actual=positive
✓ review-08: expected=negative actual=negative
✓ review-09: expected=negative actual=negative
✓ review-10: expected=negative actual=negative
✓ review-11: expected=negative actual=negative
✓ review-12: expected=negative actual=negative
✓ review-13: expected=negative actual=negative
✗ review-14: expected=negative actual=**negative**
✓ review-15: expected=neutral actual=neutral
✓ review-16: expected=neutral actual=neutral
✓ review-17: expected=neutral actual=neutral
✓ review-18: expected=neutral actual=neutral
✓ review-19: expected=neutral actual=neutral
✓ review-20: expected=neutral actual=neutral

anthropic/claude-sonnet-5 — accuracy: 90.0% (18/20), errors: 0

=== RESULTS ===
openai/gpt-5.5                             accuracy: 100.0% (20/20)
anthropic/claude-sonnet-5                  accuracy: 90.0% (18/20)
```

## Scoring

Responses are normalized only with `strip().lower()`. The result passes when it
exactly equals the expected label. Extra explanation or punctuation therefore
fails, which keeps the scorer obvious and deterministic.

## Limitations

- Twenty hand-written cases are useful for learning, not for broad model claims.
- Sentiment labels can be subjective, especially when a sentence contains mixed
  opinions.
- OpenRouter adds a routing layer, so this does not isolate direct-provider
  behavior.
- The command makes paid API requests. Use `--limit` for a small smoke test.
