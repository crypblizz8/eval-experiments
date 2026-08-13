import assert from "node:assert/strict";
import test from "node:test";

import {
  deduplicateCandidates,
  parseAnnotatedSample,
  selectCases,
} from "../prepare-data.mjs";

function sample(number, overrides = {}) {
  const identifier = String(number).padStart(4, "0");
  return {
    filepath: `data/batch1-${identifier}.jpg`,
    json_annotation: JSON.stringify({
      invoice: {
        invoice_number: `INV-${identifier}`,
        invoice_date: overrides.invoiceDate ?? "01/15/2020",
        seller_name: overrides.sellerName ?? `Seller ${identifier}`,
      },
      subtotal: { total: overrides.total ?? `${number}.00` },
    }),
    metadata: { size_bytes: 100 + number, width: 1654, height: 2339 },
  };
}

test("parseAnnotatedSample normalizes the selected ground-truth fields", () => {
  const parsed = parseAnnotatedSample(
    sample(7, {
      invoiceDate: "02/29/2020",
      sellerName: "  Example Seller  ",
      total: "12.5",
    }),
  );

  assert.deepEqual(parsed.expected, {
    invoice_number: "INV-0007",
    invoice_date: "2020-02-29",
    seller_name: "Example Seller",
    total: "12.50",
  });
});

test("parseAnnotatedSample normalizes source totals with space grouping and decimal commas", () => {
  const parsed = parseAnnotatedSample(sample(8, { total: "70 577,35" }));
  assert.equal(parsed.expected.total, "70577.35");
});

test("parseAnnotatedSample rejects impossible dates", () => {
  assert.throws(
    () => parseAnnotatedSample(sample(1, { invoiceDate: "02/30/2020" })),
    /valid calendar date/,
  );
});

test("deduplicateCandidates removes identical duplicate source records", () => {
  const candidate = parseAnnotatedSample(sample(1));
  assert.deepEqual(deduplicateCandidates([candidate, candidate]), [candidate]);
});

test("deduplicateCandidates rejects conflicting annotations for one source", () => {
  const first = parseAnnotatedSample(sample(1));
  const conflicting = parseAnnotatedSample(sample(1, { total: "999.00" }));
  assert.throws(
    () => deduplicateCandidates([first, conflicting]),
    /conflicting duplicate annotation/,
  );
});

test("selectCases is deterministic, unique, and includes all edge-case tags", () => {
  const candidates = Array.from({ length: 60 }, (_, index) =>
    parseAnnotatedSample(
      sample(index + 1, {
        invoiceDate:
          index === 0 ? "01/01/2001" : index === 59 ? "12/31/2024" : "01/15/2020",
        sellerName: index === 30 ? "The Longest Seller Name In The Fixture" : undefined,
      }),
    ),
  );

  const first = selectCases(candidates, 50, "fixed-test-seed");
  const second = selectCases(candidates, 50, "fixed-test-seed");

  assert.deepEqual(first, second);
  assert.equal(first.length, 50);
  assert.equal(new Set(first.map((item) => item.sourceId)).size, 50);
  assert.deepEqual(
    new Set(first.flatMap((item) => item.tags)),
    new Set([
      "kaggle",
      "synthetic",
      "representative",
      "edge-min-total",
      "edge-max-total",
      "edge-long-seller",
      "edge-earliest-date",
      "edge-latest-date",
    ]),
  );
});

test("selectCases rejects an undersized candidate pool", () => {
  const candidates = Array.from({ length: 10 }, (_, index) =>
    parseAnnotatedSample(sample(index + 1)),
  );
  assert.throws(() => selectCases(candidates, 50), /only 10 are available/);
});
