import { z } from "zod";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../chat/trpc/routers/_app";
import { sampleConversation } from "./preview-data";

type Outputs = inferRouterOutputs<AppRouter>;
const date = new Date("2026-01-01T00:00:00Z");
const projectId = "00000000-0000-4000-8000-000000000002";
const assignmentInput = z.object({
  conversationId: z.literal(sampleConversation.id),
  projectId: z.string().nullable(),
});

export const createProjectFixtures = (failMutation: () => void) => {
  let projects: Outputs["project"]["list"] = [
    {
      id: projectId,
      name: "Launch plan",
      icon: "rocket",
      iconColor: "purple",
      instructions: "Keep the scope small.",
      userId: "preview-user",
      createdAt: date,
      updatedAt: date,
    },
  ];
  let assigned: string | null = null;
  const resolve = (path: string, input: unknown): unknown => {
    switch (path) {
      case "project.create": {
        failMutation();
        const data = z
          .object({
            name: z.string().min(1),
            icon: z.string().default("folder"),
            iconColor: z.string().default("gray"),
            instructions: z.string().default(""),
          })
          .parse(input);
        const id = crypto.randomUUID();
        projects = [
          ...projects,
          {
            ...data,
            id,
            userId: "preview-user",
            createdAt: date,
            updatedAt: date,
          },
        ];
        return { id } satisfies Outputs["project"]["create"];
      }
      case "project.update": {
        failMutation();
        const { id, updates } = z
          .object({
            id: z.string(),
            updates: z.object({
              name: z.string().optional(),
              icon: z.string().optional(),
              iconColor: z.string().optional(),
              instructions: z.string().optional(),
            }),
          })
          .parse(input);
        projects = projects.map((project) =>
          project.id === id ? { ...project, ...updates } : project
        );
        return { success: true };
      }
      case "project.remove": {
        failMutation();
        const { id } = z.object({ id: z.string() }).parse(input);
        projects = projects.filter((project) => project.id !== id);
        if (assigned === id) {
          assigned = null;
        }
        return { success: true } satisfies Outputs["project"]["remove"];
      }
      case "project.list": {
        return projects;
      }
      case "project.forChat": {
        z.object({ id: z.literal(sampleConversation.id) }).parse(input);
        return projects.find((project) => project.id === assigned) ?? null;
      }
      case "project.assign": {
        const data = assignmentInput.parse(input);
        failMutation();
        if (
          data.projectId !== null &&
          !projects.some((project) => project.id === data.projectId)
        ) {
          throw new Error("Project unavailable");
        }
        assigned = data.projectId;
        return data satisfies Outputs["project"]["assign"];
      }
      default: {
        throw new Error(`Unsupported preview project operation: ${path}`);
      }
    }
  };
  return { resolve };
};
