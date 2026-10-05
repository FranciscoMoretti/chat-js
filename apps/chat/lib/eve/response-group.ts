import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { releaseEveGuestCreation } from "@/lib/db/eve-guests";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
} from "@/lib/db/eve-response-groups";
/* oxlint-enable sort-imports */

import { conversationBinding } from "./contracts";
import { createEveConversationOperation } from "./create-conversation-operation";
import { settleGuestCreation } from "./guest-admission";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveResponseGroupResult } from "./response-group-contracts";
/* oxlint-enable sort-imports */
import { eveResponseGroupInput } from "./response-group-input";

type CandidateResult = EveResponseGroupResult["candidates"][number];

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createEveResponseGroup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createEveResponseGroup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * init-declarations (#507): createEveResponseGroup assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): createEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): createEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): createEveResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): createEveResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): createEveResponseGroup uses 400, 404 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading group from guestAdmission; preserve one receiver evaluation, skipped accesses and the existing (await reserveEveResponseGroup(ownerId, input)) fallback. The app guidance prefers optional chaining.
    guestAdmission?.group ?? (await reserveEveResponseGroup(ownerId, input));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading reservations from guestAdmission; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading find from guestReservations; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (fork ? { fork, forkKind } : { projectId: input.projectId }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
          ...(fork ? { fork, forkKind } : { projectId: input.projectId }),
        },
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading reservationId from guestReservation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (failure.data.code === "project_not_found"               ? { code: "project_not_found" }               : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
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
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing rejection own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...rejection,
          };
        }
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        return { ...candidate, state: "unresolved" };
      }
      const binding = conversationBinding.parse(await response.json());
      return {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...candidate,
        conversationId: binding.id,
        sessionId: binding.sessionId,
        state: "bound",
      };
    } catch {
      // Network loss and native uncertainty are retried with this exact identity.
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */
