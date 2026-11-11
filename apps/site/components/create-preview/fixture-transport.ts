import { createConnectorFixtures } from "./preview-connectors";
import { sampleConversation, sampleGeneratedTitle } from "./preview-data";
import { TRPCClientError } from "@trpc/client";
import type { TRPCLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { createDocumentFixtures } from "./preview-documents";
import { createProjectFixtures } from "./preview-projects";
import { z } from "zod";
import type { AppRouter } from "../../../chat/trpc/routers/_app";

export const sampleMessageId = "sample-assistant";
export const sampleBalanceCents = 2500;
const date = new Date("2026-01-01T00:00:00Z");
type Outputs = inferRouterOutputs<AppRouter>;

const voteInput = z.object({
  conversationId: z.literal(sampleConversation.id),
  messageId: z.union([
    z.literal(sampleMessageId),
    z.string().regex(/^preview-assistant-\d+$/u),
  ]),
  type: z.enum(["up", "down"]),
});
/** A bounded terminal transport, not a server implementation. Unsupported calls fail closed. */
export const createFixtureTransport = (
  scenario: "ready" | "mutation-error"
) => {
  let deleted = false;
  let title: Pick<
    NonNullable<Outputs["eve"]["get"]>,
    "title" | "titleStatus"
  > = {
    title: sampleConversation.title,
    titleStatus: "fallback",
  };
  let isPinned = false;
  let visibility: "private" | "public" = "private";
  const updatedAt = new Date().toISOString();
  const failMutation = () => {
    if (scenario === "mutation-error") {
      throw new Error("Sample mutation failure");
    }
  };

  const connectorFixtures = createConnectorFixtures(failMutation);
  const projectFixtures = createProjectFixtures(failMutation);
  const documentFixtures = createDocumentFixtures(failMutation);
  let votes: Outputs["feedback"]["votes"] = [];
  const resolve = (path: string, input: unknown): unknown => {
    if (path.startsWith("mcp.")) {
      return connectorFixtures.resolve(path, input);
    }
    if (path.startsWith("project.")) {
      return projectFixtures.resolve(path, input);
    }
    if (path === "eve.document" || path === "eve.saveDocument") {
      return documentFixtures.resolve(path, input);
    }
    switch (path) {
      case "sharing.get": {
        z.object({ id: z.literal(sampleConversation.id) }).parse(input);
        return {
          id: sampleConversation.id,
          visibility,
        } satisfies Outputs["sharing"]["get"];
      }
      case "sharing.setVisibility": {
        const value = z
          .object({
            id: z.literal(sampleConversation.id),
            visibility: z.enum(["private", "public"]),
          })
          .parse(input);
        failMutation();
        ({ visibility } = value);
        return {
          id: sampleConversation.id,
        } satisfies Outputs["sharing"]["setVisibility"];
      }
      case "followupSuggestions.get": {
        z.object({
          conversationId: z.literal(sampleConversation.id),
          eventId: z
            .string()
            .refine(
              (value) =>
                z
                  .tuple([
                    z.literal("preview-session"),
                    z.string(),
                    z.literal("completed"),
                  ])
                  .safeParse(JSON.parse(value)).success
            ),
        }).parse(input);
        return [
          "What should I build first?",
          "How can I make it my own?",
          "What would a simple plan look like?",
        ] satisfies Outputs["followupSuggestions"]["get"];
      }
      case "credits.getAvailableCredits": {
        return {
          balanceCents: sampleBalanceCents,
        } satisfies Outputs["credits"]["getAvailableCredits"];
      }
      case "eve.list": {
        z.object({ ownerScope: z.literal("preview-user") }).parse(input);
        return {
          items: deleted
            ? []
            : [
                {
                  ...sampleConversation,
                  ...title,
                  state: "bound",
                  conversationId: sampleConversation.id,
                  createdAt: date,
                  updatedAt,
                  isPinned,
                  href: `/chat/${sampleConversation.id}`,
                  parentHref: "/",
                },
              ],
          nextCursor: null,
        } satisfies Outputs["eve"]["list"];
      }
      case "eve.get": {
        return {
          chatId: sampleConversation.id,
          ...title,
          isPinned,
          href: `/chat/${sampleConversation.id}`,
          parentHref: "/",
          visibility,
        } satisfies NonNullable<Outputs["eve"]["get"]>;
      }
      case "eve.rename": {
        failMutation();
        const next = z
          .object({ title: z.string().trim().min(1).max(255) })
          .parse(input);
        title = { ...next, titleStatus: "manual" };
        return {
          id: sampleConversation.id,
          ...title,
          isPinned,
        };
      }
      case "eve.pin": {
        failMutation();
        ({ isPinned } = z.object({ isPinned: z.boolean() }).parse(input));
        return {
          id: sampleConversation.id,
          ...title,
          isPinned,
        };
      }
      case "search.query": {
        const { search } = z
          .object({
            ownerScope: z.literal("preview-user"),
            search: z.string().trim().min(1),
          })
          .parse(input);
        const text =
          "Start with one useful conversation. Keep the interface clear.";
        const matches =
          !deleted &&
          `${title.title} ${text}`.toLowerCase().includes(search.toLowerCase());
        return {
          items: matches
            ? [
                {
                  id: sampleConversation.id,
                  conversationId: sampleConversation.id,
                  title: title.title,
                  excerpt: text,
                  updatedAt: date.toISOString(),
                  rank: 1,
                },
              ]
            : [],
          nextCursor: null,
        } satisfies Outputs["search"]["query"];
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
        votes = [
          ...votes.filter((vote) => vote.messageId !== data.messageId),
          saved,
        ];
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
  return {
    link,
    setGeneratedTitles: (enabled: boolean) => {
      const titleStatus = enabled ? "generated" : "fallback";
      if (title.titleStatus === "manual" || title.titleStatus === titleStatus) {
        return false;
      }
      title = {
        title: enabled ? sampleGeneratedTitle : sampleConversation.title,
        titleStatus,
      };
      return true;
    },
    deleteConversation: () => {
      failMutation();
      deleted = true;
    },
  };
};
