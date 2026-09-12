import { createHash } from "node:crypto";
import { z } from "zod";
import { canSpend } from "@/lib/db/credits";
import { assertEveFilesOwned } from "@/lib/db/eve-files";
import {
  CreationConflict,
  CreationProjectNotFound,
  createEveConversation,
  getEveConversation,
  getEveCreation,
} from "@/lib/db/eve-queries";
import type {
  createConversationInput,
  EveForkInput,
} from "@/lib/eve/contracts";
import { eveMessageFileKeys } from "@/lib/eve/file-references";
import { eveMessageTitle } from "@/lib/eve/message-input";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
import { assertEveConfigured, eveRequest } from "@/lib/eve/server";
import { waitForEveCheckpoint } from "./checkpoint-readiness";

export async function createEveConversationOperation(
  ownerId: string,
  input: z.infer<typeof createConversationInput>
) {
  try {
    assertEveConfigured();
  } catch {
    return Response.json(
      { error: "The agent worker is not configured." },
      { status: 503 }
    );
  }
  const fork = await resolveFork(ownerId, input.fork);
  if (fork instanceof Response) {
    return fork;
  }

  let preparedMessage:
    | Awaited<ReturnType<typeof prepareEveMessage>>
    | undefined;
  try {
    const existing = await getEveCreation(ownerId, input.operationId);
    if (existing?.state === "deleting" || existing?.state === "deleted") {
      return Response.json(
        {
          error: "This conversation has been deleted.",
          creationRejected: true,
        },
        { status: 404 }
      );
    }
    if (!existing) {
      try {
        await loadEveModelDefinition(input.modelId);
        await assertEveFilesOwned(ownerId, eveMessageFileKeys(input.message));
        preparedMessage = await prepareEveMessage(input.message, input.modelId);
      } catch {
        return Response.json(
          {
            error: "This model or attachment is not available for chat.",
            creationRejected: true,
          },
          { status: 400 }
        );
      }
      await reconcileEveOwnerUsage(ownerId);
      if (!(await canSpend(ownerId))) {
        return Response.json(
          { error: "Insufficient credits" },
          { status: 402 }
        );
      }
    }
  } catch {
    return Response.json(
      {
        error:
          "Usage reconciliation is unavailable. Try again before starting a new conversation.",
      },
      { status: 503 }
    );
  }
  try {
    const binding = await createEveConversation(
      ownerId,
      input.operationId,
      eveMessageTitle(input.message),
      async (operationId) => {
        const existing = await eveRequest(
          ownerId,
          `/eve/v1/operation/${operationId}`,
          {
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (existing.ok) {
          return z
            .object({ sessionId: z.string().min(1) })
            .parse(await existing.json()).sessionId;
        }
        const lookupFailure = z
          .object({ code: z.literal("eve_operation_not_found") })
          .safeParse(await existing.json().catch(() => null));
        if (existing.status !== 404 || !lookupFailure.success) {
          throw new Error("Native operation lookup is unavailable.");
        }
        if (fork) {
          await waitForEveCheckpoint(
            ownerId,
            fork.sessionId,
            fork.beforeTurnId
          );
        }
        // Uncertain reservations may have reached Eve before their reply was lost.
        // Reuse the same operation with the original input; never dispatch an empty turn.
        if (preparedMessage === undefined) {
          await loadEveModelDefinition(input.modelId);
          preparedMessage = await prepareEveMessage(
            input.message,
            input.modelId
          );
        }
        const result = await eveRequest(
          ownerId,
          "/eve/v1/session",
          {
            method: "POST",
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({
              message: preparedMessage,
              operationId,
              fork,
            }),
          },
          input.modelId
        );
        if (!result.ok) {
          throw new Error("Session creation failed.");
        }
        return z
          .object({ sessionId: z.string().min(1) })
          .parse(await result.json()).sessionId;
      },
      {
        initialModelId: input.modelId,
        initialContentHash:
          typeof input.message === "string"
            ? undefined
            : createHash("sha256")
                .update(JSON.stringify(input.message))
                .digest("hex"),
        fork: input.fork,
        fileKeys: eveMessageFileKeys(input.message),
        initialProjectId: input.projectId,
      }
    );
    return Response.json(binding);
  } catch (cause) {
    return creationFailure(cause);
  }
}

function creationFailure(cause: unknown) {
  if (cause instanceof CreationProjectNotFound) {
    return Response.json(
      {
        error: cause.message,
        creationRejected: true,
        code: "project_not_found",
      },
      { status: 404 }
    );
  }
  return Response.json(
    {
      error:
        cause instanceof CreationConflict
          ? cause.message
          : "Creation is unresolved. Retain this operation for reconciliation before retrying.",
    },
    { status: 409 }
  );
}

async function resolveFork(ownerId: string, input: EveForkInput | undefined) {
  if (!input) {
    return undefined;
  }
  const source = await getEveConversation(ownerId, input.conversationId);
  if (!source?.sessionId || source.state !== "bound") {
    return Response.json(
      { error: "Source conversation not found.", creationRejected: true },
      { status: 404 }
    );
  }
  return { sessionId: source.sessionId, beforeTurnId: input.beforeTurnId };
}
