/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { SuperJSON } from "superjson";
import { z } from "zod";

import type { AppRouter } from "../trpc/routers/_app";

export const conversationId = "00000000-0000-4000-8000-000000000010";
export const existingId = "00000000-0000-4000-8000-000000000003";
const inputSchema = z.object({
  conversationId: z.literal(conversationId),
  documentId: z.enum([existingId, "00000000-0000-4000-8000-000000000001"]),
  revisionId: z.uuid().optional(),
});
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const olderId = "00000000-0000-4000-8000-000000000005";
const restoredId = "00000000-0000-4000-8000-000000000006";
let restoredContent: string | undefined;
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      fetch(input, init) {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/api/trpc/eve.saveDocument") {
          const body = JSON.parse(String(init?.body));
          const saved = z
            .object({
              conversationId: z.literal(conversationId),
              documentId: z.literal(existingId),
              expectedRevisionId: z.literal(
                "00000000-0000-4000-8000-000000000004"
              ),
              content: z.string(),
              title: z.string(),
              operationId: z.uuid(),
            })
            .parse(SuperJSON.parse(JSON.stringify(body[0])));
          restoredContent = saved.content;
          return Promise.resolve(
            Response.json([
              {
                result: {
                  data: SuperJSON.serialize({
                    id: restoredId,
                    documentId: existingId,
                    kind: "text",
                    content: saved.content,
                    title: saved.title,
                    createdAt: new Date("2026-01-03T00:00:00Z"),
                  }),
                },
              },
            ])
          );
        }
        if (url.pathname !== "/api/trpc/eve.document") {
          throw new Error("Unexpected fixture request");
        }
        const requests = z
          .record(z.string(), z.unknown())
          .parse(JSON.parse(url.searchParams.get("input") ?? "{}"));
        return Promise.resolve(
          Response.json(
            Object.values(requests).map((serialized) => {
              const request = inputSchema.parse(
                SuperJSON.parse(JSON.stringify(serialized))
              );
              const existing = request.documentId === existingId;
              const latestId = existing
                ? "00000000-0000-4000-8000-000000000004"
                : "00000000-0000-4000-8000-000000000002";
              const revisionId =
                request.revisionId ??
                (existing && restoredContent !== undefined
                  ? restoredId
                  : latestId);
              if (
                request.revisionId &&
                ![latestId, olderId, restoredId].includes(request.revisionId)
              ) {
                throw new Error("Wrong revision selected");
              }
              const title = existing ? "Existing draft" : "Orchard notes";
              const createdAt = new Date("2026-01-01T00:00:00.000Z");
              let content = existing
                ? "Existing document content."
                : "# Orchard notes\n\nPlant the apple trees in autumn.";
              if (revisionId === olderId) {
                content = "Historical orchard content.";
              }
              if (revisionId === restoredId) {
                content = restoredContent ?? "";
              }
              const data: inferRouterOutputs<AppRouter>["eve"]["document"] = {
                canEdit: true,
                history: [
                  ...(existing
                    ? [
                        {
                          id: olderId,
                          parentRevisionId: null,
                          title: "Existing draft",
                          kind: "text" as const,
                          turnIndex: 0,
                          createdAt: new Date("2025-12-31T00:00:00Z"),
                        },
                      ]
                    : []),
                  {
                    id: latestId,
                    parentRevisionId: existing ? olderId : null,
                    title,
                    kind: "text",
                    turnIndex: 0,
                    createdAt,
                  },
                  ...(existing && restoredContent !== undefined
                    ? [
                        {
                          id: restoredId,
                          parentRevisionId: latestId,
                          title: "Existing draft",
                          kind: "text" as const,
                          turnIndex: 0,
                          createdAt,
                        },
                      ]
                    : []),
                ],
                revision: {
                  id: revisionId,
                  documentId: request.documentId,
                  title,
                  kind: "text",
                  content,
                  createdAt,
                },
              };
              return { result: { data: SuperJSON.serialize(data) } };
            })
          )
        );
      },
      transformer: SuperJSON,
      url: "http://fixture.invalid/api/trpc",
    }),
  ],
});
