import { z } from "zod";

import { eveDocumentWriteResult } from "@/lib/eve/document-contracts";

const researchOutput = z.union([
  z.object({ searches: z.tuple([]) }),
  z.object({ answer: z.string(), format: z.literal("clarifying_questions") }),
  eveDocumentWriteResult.extend({ format: z.literal("report") }),
]);

const researchInput = z.object({});

const researchClarification = z.object({
  need_clarification: z.boolean(),
  question: z.string(),
  verification: z.string(),
});

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const researchBrief = z.object({
  research_brief: z.string().min(1),
  title: z.string().min(1),
});
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const researchDecision = z.object({
  complete: z.boolean(),
  topics: z.array(z.string().min(1)),
});
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const researchFindings = z.object({ findings: z.string().min(1) });
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const researchReport = z.object({
  content: z.string().min(1),
  title: z.string().min(1),
});
/* oxlint-enable eslint/no-magic-numbers */
export {
  researchBrief,
  researchClarification,
  researchDecision,
  researchFindings,
  researchInput,
  researchOutput,
  researchReport,
};
