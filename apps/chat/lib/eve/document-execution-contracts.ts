import { z } from "zod";

export const documentExecutionInput = z.object({
  documentId: z.uuid(),
  revisionId: z.uuid(),
});

export function documentExecutionLanguage(
  title: string
): "python" | "javascript" | undefined {
  const extension = title.includes(".")
    ? title.split(".").at(-1)?.toLowerCase()
    : undefined;
  if (!extension || extension === "py") {
    return "python";
  }
  if (extension === "js" || extension === "mjs" || extension === "cjs") {
    return "javascript";
  }
  return undefined;
}
