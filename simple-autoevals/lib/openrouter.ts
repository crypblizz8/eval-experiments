import { FIELDS, type ExtractedFields } from "../types/invoice.ts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const PROMPT = [
  "Extract the invoice number, issue date, seller name, and final total.",
  "Format invoice_date as YYYY-MM-DD and total as a decimal without currency symbols or separators.",
].join(" ");
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "invoice_fields",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        FIELDS.map((field) => [field, { type: "string" }]),
      ),
      required: FIELDS,
    },
  },
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export function parseOpenRouterModels(value: string | undefined): string[] {
  if (!value) throw new Error("Missing OPENROUTER_MODELS");

  let models: unknown;
  try {
    models = JSON.parse(value);
  } catch {
    throw new Error("OPENROUTER_MODELS must be a JSON array");
  }

  if (
    !Array.isArray(models) ||
    models.length === 0 ||
    !models.every((model) => typeof model === "string" && model.trim())
  ) {
    throw new Error("OPENROUTER_MODELS must contain model IDs");
  }

  return models;
}

export function getOpenRouterModels(): string[] {
  return parseOpenRouterModels(process.env.OPENROUTER_MODELS);
}

function parseFields(content: string): ExtractedFields {
  let fields: unknown;
  try {
    fields = JSON.parse(content);
  } catch {
    throw new Error("OpenRouter returned invalid JSON");
  }
  if (
    typeof fields !== "object" ||
    fields === null ||
    !FIELDS.every((field) => typeof Reflect.get(fields, field) === "string")
  ) {
    throw new Error("OpenRouter returned invalid invoice fields");
  }
  return fields as ExtractedFields;
}

export async function extractFields(
  imageUrl: string,
  model: string,
): Promise<ExtractedFields> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: PROMPT,
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: RESPONSE_FORMAT,
    }),
  });

  const data = (await response.json()) as OpenRouterResponse;
  if (!response.ok) {
    throw new Error(
      `OpenRouter request failed (${response.status}): ${data.error?.message ?? "unknown error"}`,
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no message content");
  return parseFields(content);
}
