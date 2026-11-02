import { TRPCClientError } from "@trpc/client";
import type { TRPCLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import type { AppRouter } from "@/trpc/routers/_app";

export const sampleConversation = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Building something good",
  state: "bound",
};
export const sampleMessageId = "sample-assistant";
const projectId = "00000000-0000-4000-8000-000000000002";
const date = new Date("2026-01-01T00:00:00Z");
type Outputs = inferRouterOutputs<AppRouter>;

const voteInput = z.object({
  conversationId: z.literal(sampleConversation.id),
  messageId: z.literal(sampleMessageId),
  type: z.enum(["up", "down"]),
});
const assignmentInput = z.object({
  conversationId: z.literal(sampleConversation.id),
  projectId: z.string().nullable(),
});

/** A bounded terminal transport, not a server implementation. Unsupported calls fail closed. */
export const createFixtureTransport = (
  scenario: "ready" | "mutation-error"
) => {
  const projects: Outputs["project"]["list"] = [
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
  let votes: Outputs["feedback"]["votes"] = [];
  const calls: string[] = [];
  const resolve = (path: string, input: unknown): unknown => {
    calls.push(path);
    switch (path) {
      case "project.list": {
        return projects;
      }
      case "project.forChat": {
        z.object({ id: z.literal(sampleConversation.id) }).parse(input);
        return projects.find((project) => project.id === assigned) ?? null;
      }
      case "project.assign": {
        const data = assignmentInput.parse(input);
        if (scenario === "mutation-error") {
          throw new Error("Sample assignment failure");
        }
        if (
          data.projectId !== null &&
          !projects.some((project) => project.id === data.projectId)
        ) {
          throw new Error("Project unavailable");
        }
        assigned = data.projectId;
        return data satisfies Outputs["project"]["assign"];
      }
      case "feedback.votes": {
        z.object({ conversationId: z.literal(sampleConversation.id) }).parse(
          input
        );
        return votes;
      }
      case "feedback.vote": {
        const data = voteInput.parse(input);
        if (scenario === "mutation-error") {
          throw new Error("Sample feedback failure");
        }
        const saved = {
          messageId: data.messageId,
          isUpvoted: data.type === "up",
        } satisfies Outputs["feedback"]["vote"];
        votes = [saved];
        return saved;
      }
      default: {
        throw new Error(`Unsupported preview operation: ${path}`);
      }
    }
  };
  const link: TRPCLink<AppRouter> =
    () =>
    ({ op }) =>
      observable((observer) => {
        // A cancellable async boundary exposes real query/mutation pending states.
        const timer = setTimeout(() => {
          try {
            observer.next({ result: { data: resolve(op.path, op.input) } });
            observer.complete();
          } catch (error) {
            observer.error(
              TRPCClientError.from(
                error instanceof Error
                  ? error
                  : new Error("Preview operation failed")
              )
            );
          }
        }, 120);
        return () => {
          clearTimeout(timer);
        };
      });
  return { link, calls };
};
