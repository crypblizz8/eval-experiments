import { mkdir, writeFile } from "node:fs/promises";
import type { ModelResult, ModelSummary } from "../types/results.ts";

const OUTPUTS_DIR = new URL("../outputs/", import.meta.url);

export async function createOutputDirectory(now = new Date()): Promise<URL> {
  const runId = now.toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const directory = new URL(`${runId}/`, OUTPUTS_DIR);
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function writeModelResult(
  directory: URL,
  result: ModelResult,
): Promise<void> {
  const filename = result.summary.model.replace(/[^a-z0-9._-]+/gi, "_");
  const jsonl = result.cases.map((item) => JSON.stringify(item)).join("\n");
  await writeFile(new URL(`${filename}.jsonl`, directory), `${jsonl}\n`, "utf8");
}

export async function writeSummary(
  directory: URL,
  summaries: ModelSummary[],
): Promise<void> {
  await writeFile(
    new URL("summary.json", directory),
    `${JSON.stringify({ models: summaries }, null, 2)}\n`,
    "utf8",
  );
}
