# Simple AutoEvals

This project checks how well AI models read invoices.

It sends 49 synthetic invoice images to models through OpenRouter. Each model
extracts the invoice number, date, seller, and total. The project compares those
answers with the expected values and prints a score.

## Architecture
                  ┌─ Model A ──────┐
Test cases ───────├─ Model B  ───┼─ AutoEvals ─► model scores
                  └─ Model C  ──────┘

## What you need
- An [OpenRouter account](https://openrouter.ai/)
- An [OpenRouter API key](https://openrouter.ai/settings/keys)

## Set up the project

Clone the repository and enter this folder:

```bash
git clone https://github.com/crypblizz8/eval-experiments.git
cd eval-experiments/simple-autoevals
```

Install the exact dependency versions recorded by the project:

```bash
npm ci
```

Copy the example settings file:

```bash
cp .env.example .env
```

Open `.env` and add your API key and model IDs:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODELS=["openai/gpt-4o-mini"]
```

The models must support image input and structured output. You can add more than one model to compare them:

## Run it

Start with one invoice to check that everything works:

```bash
npm start -- --limit 1
```

Then run all 49 invoices:

```bash
npm start
```

The full evaluation makes 49 API requests per model. More models cost more and
take longer.

## Results

Each run creates a timestamped directory:

```text
outputs/<timestamp>/
├── provider_model-a.jsonl
├── provider_model-b.jsonl
└── summary.json
```

The JSONL files contain the predicted and expected fields for every invoice.
`summary.json` contains field and complete-document accuracy for each model.
The command prints the exact output directory when the run finishes.

## Check the code

Run the type checker and automated tests:

```bash
npm run check
npm test
```

Use `npm ci` when setting up this existing project. Use `npm install <package>`
only when you want to add or change a dependency.

## Sample Results
| Model | Fields Correct | Fields Total | Field Accuracy | Documents Correct | Documents Total | Document Accuracy |
|---|---:|---:|---:|---:|---:|---:|
| Qwen 3.7 Flash | 182 | 196 | 92.86% | 35 | 49 | 71.43% |
| Gemini 3.5 Flash-Lite | 170 | 196 | 86.73% | 26 | 49 | 53.06% |

## Dataset

The invoices come from the
[High-Quality Invoice Images for OCR](https://www.kaggle.com/datasets/osamahosamabdellatif/high-quality-invoice-images-for-ocr)
dataset through the
[Voxel51 Hugging Face mirror](https://huggingface.co/datasets/Voxel51/high-quality-invoice-images-for-ocr).
The mirror is pinned to revision
`d21f03cfeea2b330e15a229883c66d7ebece8e69` and lists the licence as ODbL-1.0.

One ambiguous invoice was removed, leaving 49 cases. The dataset is small,
synthetic, English-only, and visually repetitive. Treat the results as a simple
experiment, not a broad measure of model quality.
