import assert from "node:assert/strict";
import test from "node:test";
import { parseLimit } from "../main.ts";

test("parses an optional case limit", () => {
  assert.equal(parseLimit([]), undefined);
  assert.equal(parseLimit(["--limit", "1"]), 1);
});

test("rejects invalid case limits", () => {
  assert.throws(() => parseLimit(["--limit"]), /Usage/);
  assert.throws(() => parseLimit(["--limit", "0"]), /positive integer/);
  assert.throws(() => parseLimit(["--limit", "1.5"]), /positive integer/);
});
