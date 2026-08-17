#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { countMatchingFields } from "./lib/autoevals.ts";
import { extractFields, getOpenRouterModels } from "./lib/openrouter.ts";
import {
  createOutputDirectory,
  writeModelResult,
  writeSummary,
} from "./lib/results.ts";
import { FIELDS, type Manifest, type TestCase } from "./types/invoice.ts";
import type { CaseResult, ModelResult, ModelSummary } from "./types/results.ts";

const DATA_DIR = new URL("./data/", import.meta.url);

async function loadManifest(): Promise<Manifest> {
  const json = await readFile(new URL("invoices.json", DATA_DIR), "utf8");
  return JSON.parse(json) as Manifest;
}

export function parseLimit(args: string[]): number | undefined {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== "--limit") {
    throw new Error("Usage: npm start -- [--limit NUMBER]");
  }

  const limit = Number(args[1]);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return limit;
}

export async function run(limit?: number): Promise<void> {
  const manifest = await loadManifest();
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error("Manifest has no cases");
  }

  const cases = limit ? manifest.cases.slice(0, limit) : manifest.cases;
  const models = getOpenRouterModels();
  const outputDirectory = await createOutputDirectory();
  const summaries: ModelSummary[] = [];

  for (const model of models) {
    const result = await evaluateModel(model, cases);
    summaries.push(result.summary);
    await writeModelResult(outputDirectory, result);
    await writeSummary(outputDirectory, summaries);
  }

  console.log(`\nResults: ${fileURLToPath(outputDirectory)}`);
}

async function evaluateModel(
  model: string,
  cases: TestCase[],
): Promise<ModelResult> {
  let fieldsCorrect = 0;
  let documentsCorrect = 0;
  const results: CaseResult[] = [];

  console.log(`\n${model}`);
  for (const testCase of cases) {
    const actual = await extractFields(testCase.source_url, model);
    const correct = await countMatchingFields(actual, testCase.expected);

    fieldsCorrect += correct;
    documentsCorrect += Number(correct === FIELDS.length);
    results.push({
      model,
      case_id: testCase.id,
      actual,
      expected: testCase.expected,
      fields_correct: correct,
      passed: correct === FIELDS.length,
    });
    console.log(`${correct === FIELDS.length ? "PASS" : "FAIL"} ${testCase.id}`);
  }

  const totalDocuments = cases.length;
  const totalFields = totalDocuments * FIELDS.length;
  const summary: ModelSummary = {
    model,
    fields_correct: fieldsCorrect,
    fields_total: totalFields,
    field_accuracy: fieldsCorrect / totalFields,
    documents_correct: documentsCorrect,
    documents_total: totalDocuments,
    document_accuracy: documentsCorrect / totalDocuments,
  };
  console.log(`\nFields: ${fieldsCorrect}/${totalFields}`);
  console.log(`Documents: ${documentsCorrect}/${totalDocuments}`);
  return { cases: results, summary };
}

async function main(): Promise<void> {
  await run(parseLimit(process.argv.slice(2)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
