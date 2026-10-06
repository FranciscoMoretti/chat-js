/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../trpc/routers/_app" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { QueryClient } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
/* oxlint-enable sort-imports */
import type { inferRouterOutputs } from "@trpc/server";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { SuperJSON } from "superjson";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AppRouter } from "../trpc/routers/_app";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const conversationId = "00000000-0000-4000-8000-000000000010";

const existingId = "00000000-0000-4000-8000-000000000003";

const inputSchema = z.object({
  conversationId: z.literal(conversationId),
  documentId: z.enum([existingId, "00000000-0000-4000-8000-000000000001"]),
  revisionId: z.uuid().optional(),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const olderId = "00000000-0000-4000-8000-000000000005";
const restoredId = "00000000-0000-4000-8000-000000000006";
/* oxlint-disable init-declarations --
 * init-declarations (#507): restoredContent assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let restoredContent: string | undefined;
/* oxlint-enable init-declarations */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null -- max-lines-per-function (#510): trpcClient keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): trpcClient keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): trpcClient uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
no-undefined (#519): trpcClient uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): trpcClient accepts input; init; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): trpcClient preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
typescript/strict-boolean-expressions (#610): trpcClient intentionally keeps the existing falsy-value behavior of request.revisionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): trpcClient keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): trpcClient preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      fetch(input, init): Promise<Response> {
        // oxlint-disable-next-line no-ternary -- Keep URL argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/api/trpc/eve.saveDocument") {
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading body from init; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
          if (typeof init?.body !== "string") {
            throw new TypeError("Expected a JSON document batch body");
          }
          const body = z.array(z.unknown()).parse(JSON.parse(init.body));
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
              // oxlint-disable-next-line no-ternary -- Keep latestId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              const latestId = existing
                ? "00000000-0000-4000-8000-000000000004"
                : "00000000-0000-4000-8000-000000000002";
              const revisionId =
                request.revisionId ??
                // oxlint-disable-next-line no-ternary -- Keep ?? operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                (existing && restoredContent !== undefined
                  ? restoredId
                  : latestId);
              if (
                request.revisionId &&
                ![latestId, olderId, restoredId].includes(request.revisionId)
              ) {
                throw new Error("Wrong revision selected");
              }
              // oxlint-disable-next-line no-ternary -- Keep title as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              const title = existing ? "Existing draft" : "Orchard notes";
              const createdAt = new Date("2026-01-01T00:00:00.000Z");
              // oxlint-disable-next-line no-ternary -- Keep content as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                  // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                    // oxlint-disable-next-line no-ternary -- Keep parentRevisionId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                    parentRevisionId: existing ? olderId : null,
                    title,
                    kind: "text",
                    turnIndex: 0,
                    createdAt,
                  },
                  // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (conversationId, existingId, queryClient, trpcClient); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */
export { conversationId, existingId, queryClient, trpcClient };
/* oxlint-enable import/no-named-export */
