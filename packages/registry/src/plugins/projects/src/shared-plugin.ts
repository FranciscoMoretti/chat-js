import { z } from "zod";
import type { ChatSharedPlugin } from "@/lib/chat-plugin-contracts";

const projectCreation = z.object({ projectId: z.uuid().optional() });
const projectRoute =
  /^\/project\/(?<projectId>[^/]+)(?:\/chat\/(?<chatId>[^/]+))?$/u;
export const projectsShared = () =>
  ({
    id: "projects",
    creationFields: projectCreation.shape,
    historyFields: { projectId: z.uuid().nullable().optional() },
    validateCreation: (input: Readonly<Record<string, unknown>>) =>
      !(input.fork !== undefined && input.projectId !== undefined),
    creationScope: (input: unknown) => {
      const parsed = projectCreation.safeParse(input);
      const projectId = parsed.success ? parsed.data.projectId : undefined;
      return projectId === undefined
        ? undefined
        : {
            key: `project:${projectId}`,
            input: { projectId },
            label: "project",
          };
    },
    parseRoute: (pathname: string) => {
      const groups = projectRoute.exec(pathname)?.groups;
      return groups?.projectId === undefined
        ? undefined
        : {
            id: groups.chatId ?? null,
            contextId: groups.projectId,
            parentHref: `/project/${groups.projectId}` as const,
          };
    },
  }) satisfies ChatSharedPlugin;
