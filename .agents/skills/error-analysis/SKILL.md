---
name: error-analysis
description: Systematically inspect LLM evaluation results and traces, identify observed failure modes, separate model-quality failures from data, normalization, harness, and provider failures, and prioritize fixes. Use after sentiment, extraction, OCR, coding, voice, search, or other eval runs; after model, prompt, dataset, or pipeline changes; or when aggregate metrics are unclear or regress. Adapt sample-size expectations for small experiments and do not require production-scale trace volumes.
---

# Error Analysis

Read individual eval records before explaining aggregate scores. Build a provisional, evidence-backed account of how the evaluated system fails and which layer owns each failure.

## Follow the process

1. Establish the evaluation question, candidate models, dataset, scorer, and run configuration.
2. Load the input cases, expected outputs, raw model responses, normalized values, scores, errors, and available metadata.
3. Reconcile counts before judging quality: requested, attempted, completed, scored, passed, failed, and errored.
4. Inspect cases and write concrete observations without assuming causes.
5. Assign each observed problem to its owning layer.
6. Group repeated model-quality failures into specific categories only after reading the records.
7. Compare candidates on the same completed case set.
8. Quantify categories with explicit denominators and keep uncertainty visible.
9. Recommend the smallest fix at the layer that owns the problem.

## Scale the review to the experiment

- For a 5-case smoke run, inspect every record. Use it to verify the harness, not to estimate model quality.
- For 10-20 cases, inspect every failure and every disagreement between models; sample passes if necessary. Call categories provisional.
- For roughly 50 cases, inspect every failure plus a representative pass sample. Report rates descriptively without broad population claims.
- For 100 or more representative cases, continue until additional cases stop revealing new failure categories. Treat “no new category in the last 20 cases” as a heuristic, not a requirement.
- Never inflate a small experiment solely to satisfy a generic trace-count target.

## Record observations before categories

For each record, capture:

```markdown
| Case | Candidate | Expected | Raw output | Normalized output | Score | Error | Observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <id> | <model> | <expected> | <raw> | <actual> | Pass/Fail | <error or -> | <first observable problem> |
```

- Describe what happened: “response was `positive.` and exact match rejected it.”
- Do not speculate: avoid “the model misunderstood sentiment” unless the trace supports that conclusion.
- Focus on the first meaningful failure. Downstream symptoms often disappear when the first failure is fixed.
- Preserve raw outputs. Normalized values alone can conceal response-contract and parser problems.
- Do not start from a fixed list of domain failure categories. Let recurring categories emerge from inspected cases.

## Separate the owning layers

Classify each problem by cause layer after recording the observation. These are routing layers, not a predefined failure taxonomy.

### Provider or execution failure

Examples include authentication, rate limits, unavailable models, network failures, timeouts, empty responses, and interrupted runs.

- Report these separately from model-quality failures.
- Do not count unscored requests as incorrect answers without saying so explicitly.
- Compare models only on a common set of scored cases, or report coverage beside quality.

### Harness or pipeline defect

Examples include missing records, incorrect denominators, response metadata bugs, parsing defects, wrong prompts, case leakage, and output files that do not match the executed configuration.

- Fix or quarantine harness defects before drawing model conclusions.
- Re-run affected cases after the harness is corrected.

### Response-contract failure

Examples include extra prose when one label was required, invalid JSON, missing required keys, wrong types, and schema violations.

- Keep contract failures distinct from semantically wrong but well-formed answers.
- Prefer deterministic schema and format checks.

### Normalization or scoring mismatch

Examples include punctuation, case, whitespace, date formatting, numeric formatting, currency symbols, or seller-name variants that may be semantically equivalent.

- Decide whether the scorer is intentionally strict before calling the model wrong.
- Change normalization only through explicit, deterministic rules applied equally to every candidate.
- Re-score historical outputs after a scoring change; do not compare scores produced by different rules as if they were equivalent.

### Reference or annotation ambiguity

Examples include mixed-sentiment sentences with debatable labels, incorrect expected fields, ambiguous invoice totals, unreadable source images, and inconsistent annotations.

- Inspect the source case and reference together.
- Mark unresolved cases as ambiguous or exclude them transparently; do not silently relabel them.
- Report sensitivity when a small number of ambiguous cases materially changes the ranking.

### Model-quality failure

Use this layer only when the request completed, the output was scored correctly, and the reference is credible.

- For sentiment, distinguish semantic misclassification from output-format violations and ambiguous labels.
- For invoice extraction, distinguish wrong values, missing fields, unsupported values, and image-reading failures after schema and normalization checks.
- Name categories from repeated observations using specific, actionable language.

## Group and refine model failure modes

After inspecting enough failures to see repetition:

1. Group observations that share the same likely repair.
2. Split superficially similar observations when their causes or fixes differ.
3. Give each category a one-sentence inclusion rule.
4. Re-label all inspected failures with the proposed categories.
5. Merge overlaps and mark uncertain assignments instead of forcing them.

Prefer categories such as “negation after a positive clause ignored” or “invoice total copied from subtotal” over generic labels such as “quality,” “hallucination,” or “bad extraction.”

## Compare candidates fairly

- Use paired case-level comparisons when candidates ran on the same dataset.
- Report wins, losses, ties, and provider failures in addition to aggregate accuracy.
- Inspect every disagreement for small runs.
- Avoid declaring a winner from negligible differences or different completed-case sets.
- Record model identifiers, prompt version, parameters, dataset version, scorer version, and run timestamp when available.

Use explicit denominators:

```text
completion rate = completed requests / attempted requests
scoring coverage = scored responses / requested cases
quality rate = passing responses / scored responses
end-to-end rate = passing responses / requested cases
failure-mode rate = cases with category / relevant scored cases
```

Do not collapse these into a single “accuracy” number when execution failures occurred.

## Prioritize remediation

Work through failures in this order:

1. Fix dataset or annotation defects.
2. Fix harness, parsing, normalization, and denominator defects.
3. Fix obvious prompt, schema, or tool configuration gaps.
4. Improve the evaluated model or pipeline for persistent model-quality failures.
5. Add a new evaluator only for important recurring failures that will guide repeated iteration.

Use deterministic checks for objective properties. Introduce an LLM judge only when the criterion requires interpretation and human-labeled calibration data exists.

## Report findings

Return a compact report containing:

- run scope and artifact coverage
- count reconciliation and denominators
- highest-impact observed failures with representative case IDs
- failure categories, definitions, counts, and rates
- paired candidate disagreements when comparing models
- ambiguous or excluded cases
- prioritized fixes assigned to the owning layer
- confidence limits and what the sample does not establish

Label findings as confirmed, provisional, or unresolved. Keep small-run conclusions narrow.

## Avoid these anti-patterns

- Brainstorming domain failure categories before reading outputs
- Treating API failures as model answers
- Comparing candidates on different case sets without disclosure
- Inspecting normalized values while ignoring raw responses
- Changing scorer rules during a comparison without re-scoring all candidates
- Using generic failure labels that do not imply a repair
- Building judges before fixing deterministic or data problems
- Claiming saturation, generality, or a model winner from a smoke test
- Treating error analysis as a one-time exercise after prompts, models, datasets, or pipelines change

## Provenance

Adapted for this repository from Hamel Husain's MIT-licensed [`error-analysis`](https://github.com/hamelsmu/evals-skills/blob/main/skills/error-analysis/SKILL.md) skill.
