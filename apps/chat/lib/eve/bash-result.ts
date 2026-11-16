import { z } from "zod";

// Validate presentation data; EVE remains responsible for execution and job lifecycle.
const streams = {
  stdout: z.string(),
  stderr: z.string(),
  truncated: z.boolean(),
};
export const bashResultSchema = z.discriminatedUnion("status", [
  z.object({
    ...streams,
    status: z.literal("completed"),
    exitCode: z.number(),
  }),
  z.object({
    ...streams,
    status: z.literal("running"),
    pid: z.number(),
    outputDirectory: z.string(),
    message: z.string(),
  }),
]);
