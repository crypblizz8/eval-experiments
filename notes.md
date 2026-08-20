# Notes: Langfuse and Braintrust Starter Projects

## Repository Findings

- `README.md` lists five current tracks: simple evals, simple autoevals, coding evals, voice evals, and search evals.
- Implemented examples:
  - `simple-evals/`: 20-case, three-label sentiment classification in Python, using OpenRouter and deterministic exact-match accuracy.
  - `simple-autoevals/`: 49-image invoice extraction comparison in TypeScript using AutoEvals, with field and whole-document accuracy.
- Planned or documentation-only tracks:
  - `coding-evals/`: detailed staged design, currently no implementation files.
  - `voice-evals/`: placeholder comparing Vapi and ElevenLabs.
  - `search-evals/`: placeholder comparing Perplexity, Exa, and Parallel.
- Root backlog: OCR pipeline, vision-vs-OCR, model routing, judge reliability, and reasoning effort.
- Langfuse and Braintrust appear only in the landscape table under custom team evals; no hands-on platform exercise exists.
- Best shared baseline: reuse `simple-evals/cases.jsonl`, prompt, and exact-match label scorer. This makes the platform workflow the independent variable and avoids inventing a new evaluation problem.

## Langfuse Exercise

- Use a hosted Langfuse dataset with stable case IDs, two prompt experiments, deterministic item evaluators, automatically traced OpenAI-compatible calls, and the dataset run comparison view.
- The current SDK supports a high-level experiment runner over local or hosted datasets, automatic tracing, item/run evaluators, concurrency, and error isolation.
- Hosted datasets are worth the extra step here because they expose dataset runs and comparison as the platform-specific lesson.

## Braintrust Exercise

- Use Braintrust `Eval` with local data for the smallest first slice, two immutable experiments, deterministic scorers, and a baseline comparison.
- `bt eval --first N` creates a non-final smoke run; a full run creates the final experiment.
- A hosted/versioned Braintrust dataset is an optional extension, not a requirement.

## Synthesis

- Treat these as two sibling adapters over the same baseline, not as two unrelated projects.
- Each exercise should prove local execution plus a platform-visible experiment and comparison.
- Do not add LLM-as-judge scoring here; that belongs to the explicit judge-reliability backlog item.
- Prefer one `managed-platform-evals/` parent with shared loader, prompts, and scorers plus two thin adapters.
- Implement Braintrust first as the shorter managed-experiment loop, then Langfuse with dataset seeding and trace inspection.
