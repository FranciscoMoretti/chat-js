/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../trpc/routers/_app" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { SuperJSON } from "superjson";
import { z } from "zod";

import type { AppRouter } from "../trpc/routers/_app";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): conversationId is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): conversationId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named conversationId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const conversationId = "00000000-0000-4000-8000-000000000010";
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): existingId is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): existingId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named existingId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const existingId = "00000000-0000-4000-8000-000000000003";
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */
const inputSchema = z.object({
  conversationId: z.literal(conversationId),
  documentId: z.enum([existingId, "00000000-0000-4000-8000-000000000001"]),
  revisionId: z.uuid().optional(),
});
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): queryClient is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): queryClient stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named queryClient API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */
const olderId = "00000000-0000-4000-8000-000000000005";
const restoredId = "00000000-0000-4000-8000-000000000006";
/* oxlint-disable init-declarations --
 * init-declarations (#507): restoredContent assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let restoredContent: string | undefined;
/* oxlint-enable init-declarations */
/* oxlint-disable import/group-exports, import/no-named-export, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null --
 * import/group-exports (#523): trpcClient stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named trpcClient API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-lines-per-function (#510): trpcClient keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): trpcClient keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): trpcClient uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): trpcClient derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): trpcClient uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): trpcClient handles optional init?.body without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): trpcClient accepts input; init; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): trpcClient preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): trpcClient intentionally keeps the existing falsy-value behavior of request.revisionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): trpcClient keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): trpcClient preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      fetch(input, init): Promise<Response> {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === "/api/trpc/eve.saveDocument") {
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
/* oxlint-enable import/group-exports, import/no-named-export, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */
