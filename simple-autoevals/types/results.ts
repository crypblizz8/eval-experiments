import type {
  ExpectedFields,
  ExtractedFields,
} from "./invoice.ts";

export type CaseResult = {
  model: string;
  case_id: string;
  actual: ExtractedFields;
  expected: ExpectedFields;
  fields_correct: number;
  passed: boolean;
};

export type ModelSummary = {
  model: string;
  fields_correct: number;
  fields_total: number;
  field_accuracy: number;
  documents_correct: number;
  documents_total: number;
  document_accuracy: number;
};

export type ModelResult = {
  cases: CaseResult[];
  summary: ModelSummary;
};
