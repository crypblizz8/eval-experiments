# How practitioners use SWE-bench

## The common architecture

Most projects do not recreate SWE-bench's correctness grader. They implement
the inference side and preserve SWE-bench's patch interchange format:

```text
SWE-bench instance
  issue + pinned repository
          ↓
agent framework
  trajectory + repository edits
          ↓
predictions JSON/JSONL
  instance_id + model + git patch
          ↓
independent SWE-bench evaluator
  resolved/unresolved + test logs
```

This separation lets the same prediction file be graded locally, in the cloud,
or submitted to the hosted service.

## Common workflows

### Official local harness

The official `swebench` CLI applies candidate patches and runs benchmark tests
inside per-instance Docker environments. It can evaluate one instance, a subset,
or a full dataset. This is the native reproduction path, but local image storage,
Docker setup, and Apple Silicon builds can be substantial.

### Official hosted evaluation

Two official paths avoid local evaluation containers:

- the SWE-bench harness can run on Modal;
- `sb-cli` uploads compatible predictions to SWE-bench's hosted evaluator and
  retrieves reports.

Both keep the patch artifact and independent grader boundary. They move the
container execution elsewhere rather than eliminating it.

### mini-SWE-agent

mini-SWE-agent is the current small reference inference scaffold from the
SWE-agent team. It loads SWE-bench records, opens the corresponding task
environment, gives the issue to a bash-only agent, records the trajectory, and
exports `preds.json`. Its output is then graded by the official harness or
`sb-cli`.

It supports a single interactive instance for debugging and sliced batch runs.
This makes it the closest existing implementation to the learning exercise we
want, without rebuilding an agent loop.

### Larger agent frameworks

- OpenHands adds remote workspaces, versioned agent-server images, richer tools,
  parallel inference, event logs, and patch extraction, then invokes official
  SWE-bench grading.
- SWE-ReX abstracts where the agent shell runs: local Docker, Modal, AWS, HPC,
  and other remote environments. It is an execution layer, not the grader.
- Harbor and Inspect Evals adapt SWE-bench into unified task/job abstractions.
  They are useful for cross-agent experiments, but their abstractions can hide
  the native SWE-bench patch-and-report contract.

## Recommended learning exercise

Use one pinned SWE-bench Verified instance and three predictions:

1. official gold patch — should resolve;
2. applicable but irrelevant non-empty patch — should run and remain unresolved;
3. one real agent patch — genuine candidate result.

An empty patch is not a useful negative execution control because the official
harness classifies it as empty and does not run the tests.

For the smallest Mac-friendly workflow:

```text
mini-SWE-agent or Codex generates one patch
→ save standard predictions JSON
→ submit that one instance with sb-cli
→ inspect patch, trajectory, report, and test logs
```

This demonstrates the authentic boundary between inference and evaluation
without requiring us to implement SWE-bench or operate its local Docker fleet.
It is a benchmark-reproduction lesson, not a meaningful model ranking.

## Important current caveat

SWE-bench Verified remains useful for understanding benchmark mechanics and
reproducing historical results. It should not be presented as decisive evidence
of current frontier capability: OpenAI now cites contamination and test-quality
problems when explaining why it no longer uses Verified for frontier model
evaluation.

## Primary sources

- [Official SWE-bench repository](https://github.com/SWE-bench/SWE-bench)
- [Official evaluation guide](https://github.com/SWE-bench/SWE-bench/blob/main/docs/guides/evaluation.md)
- [Official inference reference](https://github.com/SWE-bench/SWE-bench/blob/main/docs/reference/inference.md)
- [Official hosted sb-cli](https://github.com/SWE-bench/sb-cli)
- [mini-SWE-agent SWE-bench workflow](https://mini-swe-agent.com/latest/usage/swebench/)
- [SWE-ReX](https://github.com/SWE-agent/SWE-ReX)
- [OpenHands Benchmarks](https://github.com/OpenHands/benchmarks)
- [Harbor evaluation jobs](https://www.harborframework.com/docs/run-jobs/run-evals)
- [Why OpenAI no longer evaluates on SWE-bench Verified](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)
