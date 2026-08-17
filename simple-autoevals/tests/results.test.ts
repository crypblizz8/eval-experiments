import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { writeModelResult, writeSummary } from "../lib/results.ts";
import type { ModelResult } from "../types/results.ts";

test("writes model JSONL and summary JSON", async (context) => {
  const path = await mkdtemp(join(tmpdir(), "simple-autoevals-"));
  context.after(() => rm(path, { recursive: true, force: true }));
  const directory = pathToFileURL(`${path}/`);

  const result: ModelResult = {
    cases: [
      {
        model: "provider/model-a",
        case_id: "invoice-001",
        actual: {
          invoice_number: "INV-001",
          invoice_date: "2026-08-17",
          seller_name: "Example Ltd",
          total: "10.50",
        },
        expected: {
          invoice_number: "INV-001",
          invoice_date: "2026-08-17",
          seller_name: "Example Ltd",
          total: "10.50",
        },
        fields_correct: 4,
        passed: true,
      },
    ],
    summary: {
      model: "provider/model-a",
      fields_correct: 4,
      fields_total: 4,
      field_accuracy: 1,
      documents_correct: 1,
      documents_total: 1,
      document_accuracy: 1,
    },
  };

  await writeModelResult(directory, result);
  await writeSummary(directory, [result.summary]);

  const jsonl = await readFile(join(path, "provider_model-a.jsonl"), "utf8");
  const summary = JSON.parse(await readFile(join(path, "summary.json"), "utf8"));
  assert.equal(JSON.parse(jsonl).case_id, "invoice-001");
  assert.deepEqual(summary.models, [result.summary]);
});
