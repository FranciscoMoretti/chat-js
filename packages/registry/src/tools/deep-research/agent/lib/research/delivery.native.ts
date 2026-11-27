import type { WorkflowStepToolContext } from "eve/tools";
import type { ResearchArtifact } from "./schemas";

// oxlint-disable-next-line eslint/func-style, eslint/require-await -- Keep the same durable step contract in the native distribution.
export async function publishResearchReport(
  _context: Readonly<WorkflowStepToolContext>,
  _markdown: string
): Promise<ResearchArtifact | null> {
  "use step";
  return null;
}
