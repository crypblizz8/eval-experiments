import { ExactMatch } from "autoevals";
import {
  FIELDS,
  type ExpectedFields,
  type ExtractedFields,
} from "../types/invoice.ts";

function normalize(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

export async function countMatchingFields(
  actual: ExtractedFields,
  expected: ExpectedFields,
): Promise<number> {
  const scores = await Promise.all(
    FIELDS.map((field) =>
      ExactMatch({
        output: normalize(actual[field]),
        expected: normalize(expected[field]),
      }),
    ),
  );

  return scores.filter(({ score }) => score === 1).length;
}
