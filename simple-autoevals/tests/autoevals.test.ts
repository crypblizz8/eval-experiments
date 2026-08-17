import assert from "node:assert/strict";
import test from "node:test";
import { countMatchingFields } from "../lib/autoevals.ts";
import type { ExpectedFields, ExtractedFields } from "../types/invoice.ts";

const expected: ExpectedFields = {
  invoice_number: "INV-001",
  invoice_date: "2026-08-17",
  seller_name: "Example Ltd",
  total: "10.50",
};

test("counts four exact fields", async () => {
  assert.equal(await countMatchingFields(expected, expected), 4);
});

test("ignores casing and surrounding whitespace", async () => {
  const actual = { ...expected, seller_name: "  example ltd  " };
  assert.equal(await countMatchingFields(actual, expected), 4);
});

test("counts mismatches and null predictions as incorrect", async () => {
  const actual: ExtractedFields = {
    ...expected,
    invoice_number: null,
    total: "11.00",
  };
  assert.equal(await countMatchingFields(actual, expected), 2);
});
