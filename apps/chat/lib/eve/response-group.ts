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

type CandidateResult = EveResponseGroupResult["candidates"][number];

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
