# Eval Experiments

Rabbithole experiments with evals.

Current
1. [simplest evals](./simple-evals/)
2. [simple autoevals](./simple-autoevals/)
2. coding evals
3. voice evals
4. search evals

Other
- [ ] OCR pipeline evals (LlamaBench)
- [ ] Vision vs OCR: Compare direct image understanding, OCR-to-LLM, and image-plus-OCR.
- [ ] Model routing: Test whether a cheap router can send easy tasks to cheaper models and difficult tasks to stronger ones.
- [ ] LLM judge reliability: Measure judge agreement with humans, positional bias, verbosity bias, and self-preference.
- [ ] Reasoning effort: Compare low through maximum reasoning on quality, latency, tokens, and cost.

## Landscape

| Category | Tools |
| --- | --- |
| Public leaderboards | [Artificial Analysis](https://artificialanalysis.ai/), [Design Arena](https://designarena.ai/), [Arena](https://arena.ai/) |
| Public benchmarks | [SWE-bench](https://www.swebench.com/), [Terminal-Bench](https://www.tbench.ai/), [OCRBench v2](https://99franklin.github.io/ocrbench_v2/) |
| Public API / vendor benchmarks | [Openbenchmarks](https://openbenchmarks.com/), [Coval](https://github.com/coval-ai/benchmarks), [Perplexity search_evals](https://github.com/perplexityai/search_evals) |
| Custom team evals | [Braintrust](https://www.braintrust.dev/), [Langfuse](https://langfuse.com/), [Kiln](https://kiln.tech/), [LangSmith](https://smith.langchain.com/), [Arize Phoenix](https://phoenix.arize.com/) |
| Automatic repo-aware comparisons | [OpenRouter Ori](https://openrouter.ai/docs/guides/ori/eval), [Stet](https://www.stet.sh/), [CodeProbe](https://github.com/sjarmak/codeprobe) |
| Open eval runner / frameworks | [OpenBench](https://openbench.dev/), [Harbor](https://www.harborframework.com/), [Inspect](https://inspect.aisi.org.uk/), [Verifiers](https://github.com/PrimeIntellect-ai/verifiers), [DeepEval](https://github.com/confident-ai/deepeval), [Promptfoo](https://www.promptfoo.dev/), [RAGAS](https://docs.ragas.io/), [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) |
