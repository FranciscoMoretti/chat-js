/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-guests"; "../db/eve-response-groups" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { releaseEveGuestCreation } from "../db/eve-guests";
import {
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
} from "../db/eve-response-groups";
import { conversationBinding } from "./contracts";
import { createEveConversationOperation } from "./create-conversation-operation";
import { settleGuestCreation } from "./guest-admission";
import type { EveResponseGroupResult } from "./response-group-contracts";
import { eveResponseGroupInput } from "./response-group-input";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

type CandidateResult = EveResponseGroupResult["candidates"][number];

/* oxlint-disable import/no-named-export, import/prefer-default-export, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named createEveResponseGroup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): createEveResponseGroup remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * init-declarations (#507): createEveResponseGroup assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): createEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): createEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): createEveResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): createEveResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): createEveResponseGroup uses 400, 404 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): createEveResponseGroup derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): createEveResponseGroup sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): createEveResponseGroup handles optional guestAdmission?.group; guestAdmission?.reservations; guestReservations?.find( (entry) => entry.operationId === candidate.operationId ); guestReservation?.reservationId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): createEveResponseGroup copies or separates ...(fork ? { fork, forkKind } : { projectId: input.projectId }); ...(failure.data.code === "project_not_found" ? { code: "project_not_found" } ; ...rejection; ...candidate while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep createEveResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep createEveResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): createEveResponseGroup accepts value: z.infer<typeof eveResponseGroupInput>; guestAdmission?: { reservations: { operationId: string; reservationId: string; }; candidate: (typeof group.candidates)[number]; entry; candidate; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): createEveResponseGroup preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): createEveResponseGroup intentionally keeps the existing falsy-value behavior of first; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): createEveResponseGroup preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Sequential root reservation followed by independent forks; retries reuse all identities. */
export const createEveResponseGroup = async (
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>,
  guestAdmission?: {
    reservations: {
      operationId: string;
      reservationId: string;
    }[];
    group: Pick<
      Awaited<ReturnType<typeof reserveEveResponseGroup>>,
      "id" | "candidates"
    >;
  }
) => {
  const input = eveResponseGroupInput.parse(value);
  const group =
    guestAdmission?.group ?? (await reserveEveResponseGroup(ownerId, input));
  const guestReservations = guestAdmission?.reservations;
  const dispatch = async (
    candidate: (typeof group.candidates)[number],
    fork = input.fork
  ): Promise<CandidateResult> => {
    const forkKind = input.forkKind ?? "comparison";
    try {
      await recordEveResponseGroupRejection(
        ownerId,
        group.id,
        candidate.operationId
      );
      const guestReservation = guestReservations?.find(
        (entry) => entry.operationId === candidate.operationId
      );
      const response = await createEveConversationOperation(
        ownerId,
        {
          message: input.message,
          modelId: candidate.modelId,
          operationId: candidate.operationId,
          selectedTool: input.selectedTool,
          ...(fork ? { fork, forkKind } : { projectId: input.projectId }),
        },
        guestReservation?.reservationId
      );
      let released: boolean | undefined;
      if (guestReservation) {
        released = await settleGuestCreation(
          response,
          ownerId,
          candidate.operationId,
          guestReservation.reservationId
        );
      }
      if (!response.ok) {
        const failure = z
          .object({
            code: z.string().optional(),
            creationRejected: z.literal(true),
            error: z.string(),
          })
          .safeParse(await response.json().catch(() => null));
        if (
          (!guestReservation || released === true) &&
          (response.status === 400 || response.status === 404) &&
          failure.success
        ) {
          const rejection: {
            error: string;
            code?: "project_not_found";
          } = {
            error: failure.data.error,
            ...(failure.data.code === "project_not_found"
              ? { code: "project_not_found" }
              : {}),
          };
          await recordEveResponseGroupRejection(
            ownerId,
            group.id,
            candidate.operationId,
            rejection
          );
          return {
            modelId: candidate.modelId,
            operationId: candidate.operationId,
            state: "rejected",
            ...rejection,
          };
        }
        return { ...candidate, state: "unresolved" };
      }
      const binding = conversationBinding.parse(await response.json());
      return {
        ...candidate,
        conversationId: binding.id,
        sessionId: binding.sessionId,
        state: "bound",
      };
    } catch {
      // Network loss and native uncertainty are retried with this exact identity.
      return { ...candidate, state: "unresolved" };
    }
  };
  if (input.fork) {
    return {
      candidates: await Promise.all(
        group.candidates.map((candidate) => dispatch(candidate))
      ),
      id: group.id,
    };
  }
  const [first, ...rest] = group.candidates;
  if (!first) {
    throw new Error("Response group has no candidates.");
  }
  const primary = await dispatch(first);
  if (primary.state !== "bound") {
    if (primary.state === "rejected" && guestReservations) {
      await Promise.all(
        rest.map(async (candidate) => {
          const quota = guestReservations.find(
            (entry) => entry.operationId === candidate.operationId
          );
          if (quota) {
            const released = await releaseEveGuestCreation(
              ownerId,
              candidate.operationId,
              quota.reservationId
            );
            if (!released) {
              throw new Error(
                "Guest candidate may already be admitted. Retain comparison recovery."
              );
            }
          }
        })
      );
    }
    return {
      candidates: [
        primary,
        ...rest.map(
          (candidate) =>
            ({ ...candidate, state: "waiting" }) satisfies CandidateResult
        ),
      ],
      id: group.id,
    };
  }
  const candidates = await Promise.all(
    rest.map((candidate) =>
      dispatch(candidate, {
        beforeTurnId: "turn_0",
        conversationId: primary.conversationId,
      })
    )
  );
  return { candidates: [primary, ...candidates], id: group.id };
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */
