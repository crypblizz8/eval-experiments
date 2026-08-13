#!/usr/bin/env node

/**
 * LEARNING STARTER
 *
 * This file is intentionally separate from the completed evaluation harness.
 * Rewrite the functions in the "YOUR FUNCTIONS" section to learn the pipeline:
 *
 *   OCR lines -> extracted fields -> normalized fields -> scores -> metrics
 *
 * Start with:
 *   node main.js
 *
 * After implementing extractFields(), run:
 *   node main.js --run
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = dirname(fileURLToPath(import.meta.url));
const FIELDS = ["invoice_number", "invoice_date", "seller_name", "total"];

const DEFAULT_MANIFEST = join(
  PROJECT_DIR,
  "data",
  "invoice-50",
  "evaluation-manifest-49.json",
);
const DEFAULT_OCR = join(
  PROJECT_DIR,
  "data",
  "invoice-50",
  "ocr-apple-vision-49.json",
);

// ---------------------------------------------------------------------------
// YOUR FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Stage 1: Extract the four fields from one document's ordered OCR lines.
 *
 * Each line has this shape:
 *   { text, confidence, boundingBox: { x, y, width, height } }
 *
 * Replace these nulls with your own extraction logic. Do not use `expected`
 * inside this function; that would leak the answers into your predictions.
 */
export function extractFields(lines) {
  // Useful starting point while learning:
  // console.log(lines.map((line) => line.text).join("\n"));
  void lines;

  return {
    invoice_number: null,
    invoice_date: null,
    seller_name: null,
    total: null,
  };
}

/**
 * Stage 2: Normalize harmless presentation differences before comparison.
 *
 * Examples you may eventually support:
 *   "INV-001" vs "inv 001"
 *   "10/17/2015" vs "2015-10-17"
 *   "$ 1,234.50" vs "1234.50"
 *
 * Keep rules deterministic and specific to the field.
 */
export function normalizeField(field, value) {
  void field;
  if (value === null || value === undefined) return null;
  return String(value).trim();
}

/**
 * Stage 3: Score one normalized predicted value against ground truth.
 *
 * This starter implements exact match directly so `main.js` is standalone.
 * Once you understand the loop, try replacing this comparison with AutoEvals
 * `ExactMatch`. Exact deterministic scoring is appropriate for these objective
 * invoice fields.
 */
export async function scoreField({ field, predicted, expected }) {
  const normalizedPredicted = normalizeField(field, predicted);
  const normalizedExpected = normalizeField(field, expected);

  if (normalizedPredicted === null) {
    return {
      score: 0,
      normalizedPredicted,
      normalizedExpected,
      error: "missing_prediction",
    };
  }

  const score = normalizedPredicted === normalizedExpected ? 1 : 0;

  return {
    score,
    normalizedPredicted,
    normalizedExpected,
    error: score === 1 ? null : "mismatch",
  };
}

// ---------------------------------------------------------------------------
// DATA LOADING AND EVALUATION LOOP
// You can study or rewrite these later. They first protect you from scoring a
// missing, duplicated, or incorrectly aligned dataset.
// ---------------------------------------------------------------------------

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${label} file does not exist: ${path}`);
    }
    throw new Error(`Could not read ${label}: ${path}`, { cause: error });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${path}`, { cause: error });
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Load and align every manifest case with exactly one OCR document.
 *
 * This validation completes before extractFields() or scoring runs.
 */
export async function loadEvaluationData({ manifestPath, ocrPath }) {
  const manifest = await readJson(manifestPath, "Manifest");
  const ocr = await readJson(ocrPath, "OCR");

  const datasetId = requireNonEmptyString(manifest?.id, "manifest.id");
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error("manifest.cases must be a non-empty array");
  }
  if (ocr?.dataset_id !== datasetId) {
    throw new Error(
      `OCR dataset_id ${JSON.stringify(ocr?.dataset_id)} does not match manifest id ${JSON.stringify(datasetId)}`,
    );
  }
  if (!Array.isArray(ocr.documents) || ocr.documents.length === 0) {
    throw new Error("ocr.documents must be a non-empty array");
  }

  const documentsById = new Map();
  for (const [index, document] of ocr.documents.entries()) {
    const id = requireNonEmptyString(document?.id, `ocr.documents[${index}].id`);
    if (documentsById.has(id)) {
      throw new Error(`OCR contains duplicate document id ${JSON.stringify(id)}`);
    }
    if (!Array.isArray(document.lines)) {
      throw new Error(`OCR document ${JSON.stringify(id)} must contain a lines array`);
    }
    for (const [lineIndex, line] of document.lines.entries()) {
      requireNonEmptyString(line?.text, `${id}.lines[${lineIndex}].text`);
    }
    documentsById.set(id, document);
  }

  const seenCaseIds = new Set();
  const cases = manifest.cases.map((manifestCase, index) => {
    const id = requireNonEmptyString(manifestCase?.id, `manifest.cases[${index}].id`);
    if (seenCaseIds.has(id)) {
      throw new Error(`Manifest contains duplicate case id ${JSON.stringify(id)}`);
    }
    seenCaseIds.add(id);

    const document = documentsById.get(id);
    if (!document) {
      throw new Error(`OCR is missing manifest case ${JSON.stringify(id)}`);
    }
    if (!manifestCase.expected || typeof manifestCase.expected !== "object") {
      throw new Error(`Manifest case ${JSON.stringify(id)} has no expected fields`);
    }
    for (const field of FIELDS) {
      requireNonEmptyString(
        manifestCase.expected[field],
        `${id}.expected.${field}`,
      );
    }

    return {
      id,
      imagePath: manifestCase.image_path,
      expected: manifestCase.expected,
      lines: document.lines,
    };
  });

  const unknownDocumentIds = [...documentsById.keys()].filter(
    (id) => !seenCaseIds.has(id),
  );
  if (unknownDocumentIds.length > 0) {
    throw new Error(
      `OCR contains document IDs absent from the manifest: ${unknownDocumentIds.join(", ")}`,
    );
  }

  return { datasetId, cases };
}

export async function evaluateCase(evalCase) {
  const predicted = extractFields(evalCase.lines);
  if (!predicted || typeof predicted !== "object" || Array.isArray(predicted)) {
    throw new Error(`extractFields() must return an object for ${evalCase.id}`);
  }

  const fieldResults = {};
  for (const field of FIELDS) {
    fieldResults[field] = await scoreField({
      field,
      predicted: predicted[field],
      expected: evalCase.expected[field],
    });
  }

  return {
    id: evalCase.id,
    passed: FIELDS.every((field) => fieldResults[field].score === 1),
    predicted,
    expected: evalCase.expected,
    fields: fieldResults,
  };
}

export function calculateMetrics(results) {
  const fieldsScored = results.length * FIELDS.length;
  const fieldsCorrect = results.reduce(
    (count, result) =>
      count + FIELDS.filter((field) => result.fields[field].score === 1).length,
    0,
  );
  const documentsCorrect = results.filter((result) => result.passed).length;

  return {
    documentsScored: results.length,
    documentsCorrect,
    documentAccuracy: results.length === 0 ? 0 : documentsCorrect / results.length,
    fieldsScored,
    fieldsCorrect,
    fieldAccuracy: fieldsScored === 0 ? 0 : fieldsCorrect / fieldsScored,
  };
}

function parseArguments(arguments_) {
  const options = {
    manifestPath: DEFAULT_MANIFEST,
    ocrPath: DEFAULT_OCR,
    run: false,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--run") {
      options.run = true;
      continue;
    }
    if (argument === "--manifest" || argument === "--ocr") {
      const value = arguments_[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a path`);
      }
      options[argument === "--manifest" ? "manifestPath" : "ocrPath"] = resolve(value);
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node main.js [options]

Options:
  --run              Run your extraction, normalization, and scoring functions
  --manifest <path>  Use another compatible manifest JSON
  --ocr <path>       Use another compatible OCR batch JSON
  --help             Show this help

Without --run, the file validates the complete dataset and prints one example.`);
}

function inspectDataset(data, options) {
  const example = data.cases[0];
  console.log(`Dataset ready: ${data.datasetId}`);
  console.log(`Aligned cases: ${data.cases.length}`);
  console.log(`Manifest: ${options.manifestPath}`);
  console.log(`OCR: ${options.ocrPath}`);
  console.log("\nFirst case to study:");
  console.log(`  id: ${example.id}`);
  console.log(`  OCR lines: ${example.lines.length}`);
  console.log(`  expected: ${JSON.stringify(example.expected)}`);
  console.log("  first five OCR lines:");
  for (const line of example.lines.slice(0, 5)) {
    console.log(`    - ${line.text}`);
  }
  console.log("\nNext: implement extractFields() and normalizeField(), then run:");
  console.log("  node main.js --run");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const data = await loadEvaluationData(options);
  if (!options.run) {
    inspectDataset(data, options);
    return;
  }

  const results = [];
  for (const evalCase of data.cases) {
    const result = await evaluateCase(evalCase);
    results.push(result);
    const marker = result.passed ? "PASS" : "FAIL";
    console.log(`${marker} ${result.id}`);
  }

  const metrics = calculateMetrics(results);
  console.log("\nYour deterministic results:");
  console.log(
    `  fields: ${metrics.fieldsCorrect}/${metrics.fieldsScored} (${(metrics.fieldAccuracy * 100).toFixed(2)}%)`,
  );
  console.log(
    `  documents: ${metrics.documentsCorrect}/${metrics.documentsScored} (${(metrics.documentAccuracy * 100).toFixed(2)}%)`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
