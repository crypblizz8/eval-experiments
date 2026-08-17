import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFields,
  parseOpenRouterModels,
} from "../lib/openrouter.ts";

test("parses the OpenRouter model list", () => {
  assert.deepEqual(
    parseOpenRouterModels('["provider/model-a", "provider/model-b"]'),
    ["provider/model-a", "provider/model-b"],
  );
});

test("rejects invalid OpenRouter model lists", () => {
  assert.throws(() => parseOpenRouterModels(undefined), /Missing OPENROUTER_MODELS/);
  assert.throws(() => parseOpenRouterModels("not-json"), /must be a JSON array/);
  assert.throws(() => parseOpenRouterModels("[]"), /must contain model IDs/);
});

test("sends the selected model and image to OpenRouter", async (context) => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  context.after(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  let requestBody: Record<string, unknown> | undefined;
  context.mock.method(globalThis, "fetch", async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                invoice_number: "INV-001",
                invoice_date: "2026-08-17",
                seller_name: "Example Ltd",
                total: "10.50",
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  const result = await extractFields(
    "https://example.com/invoice.jpg",
    "provider/model-a",
  );

  assert.equal(requestBody?.model, "provider/model-a");
  assert.equal(result.invoice_number, "INV-001");
  assert.match(JSON.stringify(requestBody), /https:\/\/example\.com\/invoice\.jpg/);
});
