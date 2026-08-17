export const FIELDS = [
  "invoice_number",
  "invoice_date",
  "seller_name",
  "total",
] as const;

export type Field = (typeof FIELDS)[number];
export type ExtractedFields = Record<Field, string | null>;
export type ExpectedFields = Record<Field, string>;

export type TestCase = {
  id: string;
  source_url: string;
  expected: ExpectedFields;
};

export type Manifest = {
  cases: TestCase[];
};
