import type { z } from "zod";

/** Check authored results against the same contract used by the renderer.
 * NoInfer keeps the schema authoritative: an incorrect result cannot widen it.
 * Use schema.parse directly for genuinely unknown provider responses.
 */
export const validateToolOutput = <Output, Input>(
  schema: z.ZodType<Output, Input>,
  output: NoInfer<Input>
): Output => schema.parse(output);
