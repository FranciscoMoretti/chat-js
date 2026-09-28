import { z } from "zod";

export const researchInput = z.object({});
export const researchClarification = z.object({
  need_clarification: z.boolean(),
  question: z.string(),
  verification: z.string(),
});
export const researchBrief = z.object({
  research_brief: z.string().min(1),
  title: z.string().min(1),
});
export const researchDecision = z.object({
  complete: z.boolean(),
  topics: z.array(z.string().min(1)),
});
export const researchFindings = z.object({ findings: z.string().min(1) });
export const researchReport = z.object({
  content: z.string().min(1),
  title: z.string().min(1),
});
