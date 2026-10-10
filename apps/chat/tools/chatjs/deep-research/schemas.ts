import { eveDocumentWriteResult } from "@/lib/eve/document-contracts";
import { z } from "zod";

const MINIMUM_RESEARCH_TEXT_LENGTH = 1;

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

const researchBrief = z.object({
  research_brief: z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH),
  title: z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH),
});

const researchDecision = z.object({
  complete: z.boolean(),
  topics: z.array(z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH)),
});

const researchFindings = z.object({
  findings: z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH),
});

const researchReport = z.object({
  content: z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH),
  title: z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (researchBrief, researchClarification, researchDecision, researchFindings, researchInput, researchOutput, researchReport); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  researchBrief,
  researchClarification,
  researchDecision,
  researchFindings,
  researchInput,
  researchOutput,
  researchReport,
};
/* oxlint-enable import/no-named-export */
