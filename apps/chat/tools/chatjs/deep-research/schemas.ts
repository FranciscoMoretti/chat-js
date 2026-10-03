import { z } from "zod";

import { eveDocumentWriteResult } from "@/lib/eve/document-contracts";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const researchOutput = z.union([
  z.object({ searches: z.tuple([]) }),
  z.object({ answer: z.string(), format: z.literal("clarifying_questions") }),
  eveDocumentWriteResult.extend({ format: z.literal("report") }),
]);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const researchInput = z.object({});
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const researchClarification = z.object({
  need_clarification: z.boolean(),
  question: z.string(),
  verification: z.string(),
});
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const researchBrief = z.object({
  research_brief: z.string().min(1),
  title: z.string().min(1),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const researchDecision = z.object({
  complete: z.boolean(),
  topics: z.array(z.string().min(1)),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const researchFindings = z.object({ findings: z.string().min(1) });
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const researchReport = z.object({
  content: z.string().min(1),
  title: z.string().min(1),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/group-exports */
