import { z } from "zod";

import { releaseEveGuestCreation } from "@/lib/db/eve-guests";
import {
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
} from "@/lib/db/eve-response-groups";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { conversationBinding } from "./contracts";
import { createEveConversationOperation } from "./create-conversation-operation";
import { settleGuestCreation } from "./guest-admission";
import type { EveResponseGroupResult } from "./response-group-contracts";
import { eveResponseGroupInput } from "./response-group-input";

type CandidateResult = EveResponseGroupResult["candidates"][number];

/**
 * Independent workspaces may run together; shared-workspace forks advance in order with stable identities.
 *
 * @param {string} ownerId Owner whose comparison group and candidate identities are reserved.
 * @param {z.infer<typeof eveResponseGroupInput>} value Comparison input validated before reservation and dispatch.
 * @param {{ reservations: { operationId: string; reservationId: string; }[]; group: Pick< Awaited<ReturnType<typeof reserveEveResponseGroup>>, "id" | "candidates" >; }} guestAdmission Optional pre-reserved guest group and quotas used instead of reserving another group.
 * @returns {Promise<{ id: string; candidates: CandidateResult[] }>} The group identity and ordered bound, rejected, unresolved or waiting candidate results; later root candidates remain waiting until the primary binds.
 */
export const createEveResponseGroup = async (
  ownerId: string,
  value: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>,
  guestAdmission?: ReadonlyNativeSurface<{
    readonly reservations: {
      readonly operationId: string;
      readonly reservationId: string;
    }[];
    readonly group: Pick<
      Awaited<ReturnType<typeof reserveEveResponseGroup>>,
      "id" | "candidates"
    >;
  }>
): Promise<EveResponseGroupResult> => {
  const input = eveResponseGroupInput.parse(value);
  const group =
    guestAdmission?.group ?? (await reserveEveResponseGroup(ownerId, input));
  const guestReservations = guestAdmission?.reservations;
  const dispatch = async (
    candidate: ReadonlyNativeSurface<(typeof group.candidates)[number]>,
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
        const failureBody: unknown = await response.json().catch(() => null);
        if (
          response.status === 409 &&
          z.object({ code: z.literal("workspace_busy") }).safeParse(failureBody)
            .success
        ) {
          return { ...candidate, state: "waiting" };
        }
        const failure = z
          .object({
            code: z.string().optional(),
            creationRejected: z.literal(true),
            error: z.string(),
          })
          .safeParse(failureBody);
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
    const candidates: CandidateResult[] = [];
    let blocked = false;
    for (const candidate of group.candidates) {
      if (blocked) {
        candidates.push({ ...candidate, state: "waiting" });
        continue;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Fork candidates share one workspace; advance only in order and stop at unconfirmed delivery or certified workspace backpressure.
      const result = await dispatch(candidate);
      candidates.push(result);
      blocked = result.state === "waiting" || result.state === "unresolved";
    }
    return { candidates, id: group.id };
  }
  const [first, ...rest] = group.candidates;
  if (!(first !== undefined)) {
    throw new Error("Response group has no candidates.");
  }
  const primary = await dispatch(first);
  if (primary.state !== "bound") {
    if (primary.state === "rejected" && guestReservations) {
      await Promise.all(
        rest.map(async (candidate: { readonly operationId: string }) => {
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
    rest.map(async (candidate) => await dispatch(candidate))
  );
  return { candidates: [primary, ...candidates], id: group.id };
};
