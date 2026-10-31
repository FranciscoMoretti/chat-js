import { z } from "zod";
import { installedPlugins } from "@/integrations/plugin-catalog";
import type { ChatCreationScope } from "@/lib/chat-plugin-contracts";

export const projectCreationInput = z.object({
  projectId: z.uuid().optional(),
});

export const projectSelectionAvailable = (
  projectId: string | undefined
): boolean => projectId === undefined || installedPlugins.has("projects");

/** The original request determines draft location, independently of current membership. */
export const projectCreationScope = (
  input: unknown
): ChatCreationScope | undefined => {
  const parsed = projectCreationInput.safeParse(input);
  const projectId = parsed.success ? parsed.data.projectId : undefined;
  return projectId === undefined
    ? undefined
    : { key: `project:${projectId}`, label: "project" };
};
