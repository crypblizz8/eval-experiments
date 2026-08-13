import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DATASET_REVISION = "d21f03cfeea2b330e15a229883c66d7ebece8e69";
const DATASET_REPOSITORY = "Voxel51/high-quality-invoice-images-for-ocr";
const DATASET_PAGE = `https://huggingface.co/datasets/${DATASET_REPOSITORY}`;
const KAGGLE_PAGE =
  "https://www.kaggle.com/datasets/osamahosamabdellatif/high-quality-invoice-images-for-ocr";
const METADATA_URL = `${DATASET_PAGE}/raw/${DATASET_REVISION}/samples.json`;
const IMAGE_BASE_URL = `${DATASET_PAGE}/resolve/${DATASET_REVISION}`;
const DEFAULT_COUNT = 50;
const SELECTION_SEED = "simple-autoevals-invoice-50-v1";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = join(SCRIPT_DIR, "data", "invoice-50");

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function parseIsoDate(value, label) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
    requireNonEmptyString(value, label),
  );
  if (!match) {
    throw new Error(`${label} must use MM/DD/YYYY format`);
  }

  const [, month, day, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error(`${label} is not a valid calendar date`);
  }
  return `${year}-${month}-${day}`;
}

function parseMoney(value, label) {
  const text = requireNonEmptyString(value, label).normalize("NFKC");
  if (!/^(?:(?:\d{1,3}(?: \d{3})+)|\d+)(?:[.,]\d{1,2})?$/.test(text)) {
    throw new Error(
      `${label} must be a non-negative decimal with optional space thousands separators`,
    );
  }
  const number = Number(text.replaceAll(" ", "").replace(",", "."));
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be finite`);
  }
  return number.toFixed(2);
}

export function parseAnnotatedSample(sample) {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    throw new Error("sample must be an object");
  }

  const sourceId = requireNonEmptyString(sample.filepath, "sample filepath");
  if (!/^data\/batch1-\d{4}\.jpg$/.test(sourceId)) {
    throw new Error(`unsupported annotated filepath: ${sourceId}`);
  }

  let annotation;
  try {
    annotation = JSON.parse(
      requireNonEmptyString(sample.json_annotation, `${sourceId} annotation`),
    );
  } catch (error) {
    throw new Error(`${sourceId} contains invalid annotation JSON`, { cause: error });
  }

  const invoice = annotation?.invoice;
  const subtotal = annotation?.subtotal;
  if (!invoice || typeof invoice !== "object" || !subtotal || typeof subtotal !== "object") {
    throw new Error(`${sourceId} annotation has an unexpected schema`);
  }

  const metadata = sample.metadata;
  if (!metadata || typeof metadata !== "object") {
    throw new Error(`${sourceId} is missing image metadata`);
  }
  const sizeBytes = Number(metadata.size_bytes);
  const width = Number(metadata.width);
  const height = Number(metadata.height);
  if (![sizeBytes, width, height].every(Number.isSafeInteger)) {
    throw new Error(`${sourceId} has invalid image metadata`);
  }

  return {
    sourceId,
    sourceFilename: basename(sourceId),
    sourceUrl: `${IMAGE_BASE_URL}/${sourceId}`,
    expectedSizeBytes: sizeBytes,
    width,
    height,
    expected: {
      invoice_number: requireNonEmptyString(
        invoice.invoice_number,
        `${sourceId} invoice_number`,
      ),
      invoice_date: parseIsoDate(invoice.invoice_date, `${sourceId} invoice_date`),
      seller_name: requireNonEmptyString(invoice.seller_name, `${sourceId} seller_name`),
      total: parseMoney(subtotal.total, `${sourceId} total`),
    },
  };
}

export function deduplicateCandidates(candidates) {
  const unique = new Map();
  for (const candidate of candidates) {
    const existing = unique.get(candidate.sourceId);
    if (!existing) {
      unique.set(candidate.sourceId, candidate);
      continue;
    }
    if (JSON.stringify(existing) !== JSON.stringify(candidate)) {
      throw new Error(`conflicting duplicate annotation for ${candidate.sourceId}`);
    }
  }
  return [...unique.values()];
}

function compareSourceId(left, right) {
  return left.sourceId.localeCompare(right.sourceId);
}

function chooseUnique(candidates, used, comparator) {
  const candidate = candidates
    .filter((item) => !used.has(item.sourceId))
    .toSorted(comparator)[0];
  if (!candidate) {
    throw new Error("not enough unique annotated cases for edge-case selection");
  }
  used.add(candidate.sourceId);
  return candidate;
}

function rankForSeed(candidate, seed) {
  return createHash("sha256")
    .update(`${seed}:${candidate.sourceId}`)
    .digest("hex");
}

export function selectCases(candidates, count = DEFAULT_COUNT, seed = SELECTION_SEED) {
  if (!Number.isSafeInteger(count) || count < 5) {
    throw new Error("count must be an integer of at least 5");
  }
  if (candidates.length < count) {
    throw new Error(`requested ${count} cases but only ${candidates.length} are available`);
  }
  if (new Set(candidates.map((candidate) => candidate.sourceId)).size !== candidates.length) {
    throw new Error("annotated dataset contains duplicate source IDs");
  }

  const used = new Set();
  const edgeCases = [
    [
      "edge-min-total",
      chooseUnique(candidates, used, (left, right) =>
        Number(left.expected.total) - Number(right.expected.total) || compareSourceId(left, right),
      ),
    ],
    [
      "edge-max-total",
      chooseUnique(candidates, used, (left, right) =>
        Number(right.expected.total) - Number(left.expected.total) || compareSourceId(left, right),
      ),
    ],
    [
      "edge-long-seller",
      chooseUnique(candidates, used, (left, right) =>
        right.expected.seller_name.length - left.expected.seller_name.length ||
        compareSourceId(left, right),
      ),
    ],
    [
      "edge-earliest-date",
      chooseUnique(candidates, used, (left, right) =>
        left.expected.invoice_date.localeCompare(right.expected.invoice_date) ||
        compareSourceId(left, right),
      ),
    ],
    [
      "edge-latest-date",
      chooseUnique(candidates, used, (left, right) =>
        right.expected.invoice_date.localeCompare(left.expected.invoice_date) ||
        compareSourceId(left, right),
      ),
    ],
  ];

  const representativeCases = candidates
    .filter((candidate) => !used.has(candidate.sourceId))
    .map((candidate) => ({ candidate, rank: rankForSeed(candidate, seed) }))
    .toSorted((left, right) =>
      left.rank.localeCompare(right.rank) || compareSourceId(left.candidate, right.candidate),
    )
    .slice(0, count - edgeCases.length)
    .map(({ candidate }) => ["representative", candidate]);

  return [...representativeCases, ...edgeCases]
    .toSorted((left, right) => compareSourceId(left[1], right[1]))
    .map(([tag, candidate], index) => ({
      ...candidate,
      id: `invoice-${String(index + 1).padStart(3, "0")}`,
      tags: ["kaggle", "synthetic", tag],
    }));
}

async function fetchWithRetries(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "simple-autoevals/1.0" } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
      }
    }
  }
  throw new Error(`download failed after ${attempts} attempts: ${url}`, { cause: lastError });
}

async function loadMetadata(metadataPath) {
  const text = metadataPath
    ? await readFile(metadataPath, "utf8")
    : await (await fetchWithRetries(METADATA_URL)).text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error("dataset metadata is not valid JSON", { cause: error });
  }
  if (!Array.isArray(payload.samples)) {
    throw new Error("dataset metadata must contain a samples array");
  }
  return payload.samples;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readOrDownloadImage(selectedCase, imagePath) {
  try {
    const existing = await readFile(imagePath);
    if (
      existing.length === selectedCase.expectedSizeBytes &&
      existing.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    ) {
      return existing;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const response = await fetchWithRetries(selectedCase.sourceUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    throw new Error(`${selectedCase.sourceId} download is not a JPEG`);
  }
  if (buffer.length !== selectedCase.expectedSizeBytes) {
    throw new Error(
      `${selectedCase.sourceId} size mismatch: expected ${selectedCase.expectedSizeBytes}, got ${buffer.length}`,
    );
  }

  const temporaryPath = `${imagePath}.tmp`;
  try {
    await writeFile(temporaryPath, buffer);
    await rename(temporaryPath, imagePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  return buffer;
}

function parseArguments(argumentsList) {
  const options = {
    count: DEFAULT_COUNT,
    metadataPath: undefined,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];
    if (argument === "--count" && value) {
      options.count = Number(value);
      index += 1;
    } else if (argument === "--metadata" && value) {
      options.metadataPath = resolve(value);
      index += 1;
    } else if (argument === "--output" && value) {
      options.outputDir = resolve(value);
      index += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${argument}`);
    }
  }
  return options;
}

export async function prepareDataset(options) {
  const samples = await loadMetadata(options.metadataPath);
  const annotatedRecords = samples
    .filter((sample) => sample?.json_annotation != null)
    .map(parseAnnotatedSample);
  const annotated = deduplicateCandidates(annotatedRecords);
  const selected = selectCases(annotated, options.count, SELECTION_SEED);
  const imagesDirectory = join(options.outputDir, "images");
  await mkdir(imagesDirectory, { recursive: true });

  const manifestCases = [];
  for (const [index, selectedCase] of selected.entries()) {
    const imagePath = join(imagesDirectory, selectedCase.sourceFilename);
    const buffer = await readOrDownloadImage(selectedCase, imagePath);
    manifestCases.push({
      id: selectedCase.id,
      source_id: selectedCase.sourceId,
      source_url: selectedCase.sourceUrl,
      image_path: `images/${selectedCase.sourceFilename}`,
      source_sha256: sha256(buffer),
      width: selectedCase.width,
      height: selectedCase.height,
      expected: selectedCase.expected,
      tags: selectedCase.tags,
    });
    console.log(`[${index + 1}/${selected.length}] ${selectedCase.sourceFilename}`);
  }

  const manifest = {
    version: 1,
    id: "invoice-image-50-v1",
    name: "Invoice Image 50",
    description: "Fifty deterministically selected annotated synthetic invoice images.",
    source: {
      original_name: "High-Quality Invoice Images for OCR",
      original_url: KAGGLE_PAGE,
      mirror_url: DATASET_PAGE,
      mirror_revision: DATASET_REVISION,
      license: "ODbL-1.0",
      attribution: "Osama Hosam Abdellatif; Voxel51 dataset mirror",
    },
    selection: {
      annotated_records: annotatedRecords.length,
      annotated_candidates: annotated.length,
      duplicate_records_removed: annotatedRecords.length - annotated.length,
      count: manifestCases.length,
      seed: SELECTION_SEED,
      method:
        "45 lowest SHA-256 ranks by seed and source ID, plus five unique edge cases; final order by source ID",
      edge_cases: [
        "minimum total",
        "maximum total",
        "longest seller name",
        "earliest invoice date",
        "latest invoice date",
      ],
    },
    fields: ["invoice_number", "invoice_date", "seller_name", "total"],
    cases: manifestCases,
  };

  await writeFile(join(options.outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = await prepareDataset(options);
  console.log(
    `Prepared ${manifest.cases.length} cases from ${manifest.selection.annotated_candidates} annotated candidates.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
