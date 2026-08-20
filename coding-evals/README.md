# Coding Evals

## Learning goal

Learn how a coding benchmark turns a natural-language engineering task into a
reproducible score.

The first exercise is intentionally smaller than SWE-bench or OpenBench. It
keeps their essential measurement loop visible:

```text
task + clean workspace
        ↓
candidate edits an isolated copy
        ↓
independent checker runs
        ↓
one auditable result row
        ↓
matched results are summarized
```

The goal is not to rank models from two toy tasks. The goal is to understand
what must be true before a coding benchmark result is trustworthy.

## Benchmark question

Can a coding agent complete two small, deterministic Python maintenance tasks
when each attempt starts from the same clean workspace?

Initial live candidate: Codex with `gpt-5.6-sol`, one attempt per task. The
model identifier, reasoning effort, CLI version, timeout, task digest, and Git
commit must be recorded rather than implied.

## Slice 1: prove the benchmark offline

Build two locally authored tasks:

1. Fix a failing implementation without changing the tests.
2. Implement one missing behavior from a short specification.

Each task contains:

```text
tasks/<task-id>/
├── instruction.md   # normal engineering request shown to the candidate
├── workspace/       # clean starting repository
├── checker/         # grader-owned tests, outside the editable workspace
└── solution/        # golden files used only to validate the task
```

Before any paid or nondeterministic run, validate both task polarities:

- untouched workspace + checker must fail;
- golden solution overlay + checker must pass.

Then run two controls through the same result path:

- `null`: makes no edits and must fail every task;
- `oracle`: overlays the golden solution and must pass every task.

These controls are more important than a polished report. If either behaves
unexpectedly, the benchmark is broken and a model score is meaningless.

## Slice 2: add one real agent

For every task:

1. Copy `workspace/` to a fresh temporary directory.
2. Invoke one headless coding-agent runner with `instruction.md` and that copy
   as its working directory.
3. Run the independent checker with a hard timeout.
4. Distinguish task failure from runner, timeout, parsing, or checker failure.
5. Append one JSON object to `outputs/<run-id>/results.jsonl`.

Do not run model-generated code directly on the host merely because the task is
small. A subprocess timeout is not a security boundary. Slice 2 begins only
after choosing an isolation lane, preferably a disposable container or a small
OpenBench/Harbor task run. Slice 1 remains fully useful and credential-free.

## Result contract

Keep one row per `(task, runner, model, trial)` and preserve at least:

```text
run_id
timestamp
task_id and task digest
runner and runner version
model and reasoning effort
trial
completion status
graded success
error category
checker exit code
wall time
timeout
stdout/stderr paths or captured excerpts
repository commit
```

`completed` and `success` are deliberately separate. A runner can exit cleanly
after producing a wrong solution; only the checker decides whether the task was
solved.

## First report

Print a small terminal table with:

- per-task pass/fail;
- solved count and pass@1;
- median wall time for completed attempts;
- failures grouped as wrong answer, timeout, runner error, or checker error.

One attempt per task teaches the mechanics. Three attempts may be added later to
show stochasticity and Wilson confidence intervals, but two toy tasks cannot
support leaderboard claims.

## What we borrow from OpenBench

- Fresh disposable workspace for every cell.
- Normal engineering instructions that do not reveal checker internals.
- An external deterministic checker as the sole judge.
- Baseline-fails and golden-passes task validation.
- Null and oracle controls.
- Raw JSONL as the source of truth.
- Stable run identity, task/model/runner versions, and honest denominators.
- Inspection of every failed cell before trusting an aggregate.

## What we intentionally defer

- SWE-bench or Terminal-Bench dataset ingestion.
- Multiple harness adapters.
- Harbor suite schemas and schedulers.
- Retries, concurrency, resume, and distributed execution.
- Partial credit and pass@k.
- Token proxying, cache accounting, and cost normalization.
- Public dashboards, release bundles, cryptographic seals, and leaderboards.

Those are useful production benchmark features, but they obscure the first
lesson: a task, a clean attempt, an independent oracle, and auditable evidence.

## Proposed implementation shape

Match the repository's small Python experiments:

```text
coding-evals/
├── README.md
├── pyproject.toml
├── eval.py
├── test_eval.py
└── tasks/
    ├── fix-bug/
    └── implement-behavior/
```

Use Python 3.12 with `uv` and standard-library `unittest` for the offline slice.
Do not introduce a reusable eval framework. Add a real candidate adapter only
after the controls, task validator, fresh-copy behavior, result schema, and
offline tests are working.

## Success criteria

- Both task checkers fail on their untouched workspaces.
- Both task checkers pass with their golden solutions.
- The null control records 0/2 and the oracle records 2/2.
- Every attempt uses a fresh copy and cannot contaminate the next attempt.
- Task failures and infrastructure failures remain distinguishable in JSONL.
- The same saved rows reproduce the same summary without another model call.
- A future live run changes only the candidate runner, not the tasks or grader.

## References

- [OpenBench repository](https://github.com/minghinmatthewlam/openbench)
- [OpenBench leaderboard](https://openbench.run/)
- [OpenBench task format](https://github.com/minghinmatthewlam/openbench#task-format)
- [OpenBench methodology write-up](https://github.com/minghinmatthewlam/openbench/blob/main/WRITEUP.md)
