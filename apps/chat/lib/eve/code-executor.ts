import type { ToolContext } from "eve/tools";
import { z } from "zod";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { ToolResult } from "./tool-result";

type CodeExecutionInput = Readonly<{
  code: string;
  language: "python" | "javascript";
  title: string;
}>;

type CodeExecutionContext = Pick<
  ToolContext,
  "abortSignal" | "callId" | "session"
>;

/** Providers specialize chart formats while sharing the durable output envelope. */
const codeExecutionOutputSchema = z.object({
  chart: z.json(),
  message: z.string(),
});
type CodeExecutionOutput = z.infer<typeof codeExecutionOutputSchema>;

/** Executes exact source and owns its single usage receipt under the invoking tool call. */
type CodeExecutor = (
  input: CodeExecutionInput,
  context: ReadonlyNativeSurface<CodeExecutionContext>
) => Promise<ToolResult<CodeExecutionOutput>>;

export type { CodeExecutionContext, CodeExecutionInput, CodeExecutor };
