import { dispatchEveCopy } from "@/lib/db/eve-copy-dispatch";
import { snapshotPublicEveCopyDocuments } from "@/lib/db/eve-copy-documents";
import {
  EveCopySourceChangedError,
  getEveCopyOperation,
  rejectEveCopyPreflight,
  reserveEveCopyOperation,
} from "@/lib/db/eve-copy-journal";
import {
  acceptEveCopy,
  writeEveCopyDocuments,
  writeEveCopyFile,
} from "@/lib/db/eve-copy-resources";
import { downloadFile, uploadFileAtKey } from "@/lib/file-storage";
import { CreationConflictError } from "@/lib/db/eve-queries";
import type { EveCopyInput } from "./copy-input";

import { assertEveConfigured } from "./server";
import { createNativeEveCopy } from "./create-native-copy";
import { deleteUnacceptedEveCopy } from "./delete-unaccepted-copy";
import {
  EveModelUnavailableError,
  loadEveModelDefinition,
} from "./model-selection";
import { prepareEveCopyPlan } from "./prepare-copy-plan";
import { readPublicEveCopyFile } from "@/lib/db/eve-copy-source-file";
import { readPublicEveCopySource } from "./public-copy-source";

const prepareCopyReservation = async (
  ownerId: string,
  input: EveCopyInput,
  origin: string
): Promise<Awaited<ReturnType<typeof reserveEveCopyOperation>>> => {
  try {
    await loadEveModelDefinition(input.modelId);
  } catch (error) {
    if (error instanceof EveModelUnavailableError) {
      await rejectEveCopyPreflight(ownerId, input.operationId);
    }
    throw error;
  }
  const source = await readPublicEveCopySource(input.sourceConversationId);
  const documents = await snapshotPublicEveCopyDocuments(
    source.id,
    source.sessionId,
    source.projection.resources,
    source.boundaries
  );
  const plan = await prepareEveCopyPlan(
    source.projection,
    documents,
    async (key) => await readPublicEveCopyFile(source, key, downloadFile),
    origin
  );
  try {
    return await reserveEveCopyOperation(ownerId, {
      ...input,
      plan,
      projectionHash: source.projection.projectionHash,
      sourceOwnerId: source.ownerId,
      sourceSessionId: source.sessionId,
      title: source.title,
    });
  } catch (error) {
    // Concurrent preparations choose one durable allocation. Recover a lost reservation reply too.
    const saved = await getEveCopyOperation(ownerId, input.operationId);
    if (!saved) {
      throw error;
    }
    return saved;
  }
};

/**
 * Saves an idle native copy under one durable operation; billing begins on its first model turn.
 * @param {string} ownerId Owner whose reservation, attachments, and copied conversation are used.
 * @param {EveCopyInput} input Source/model request checked against any previous reservation for this operation.
 * @param {string} origin Origin used to resolve public source resources while preparing the copy plan.
 * @returns {Promise<Awaited<ReturnType<typeof dispatchEveCopy>>>} The dispatched copy binding after owned files/documents have been accepted.
 */
export const saveEveCopyOperation = async (
  ownerId: string,
  input: EveCopyInput,
  origin: string
): Promise<Awaited<ReturnType<typeof dispatchEveCopy>>> => {
  assertEveConfigured();
  const saved =
    (await getEveCopyOperation(ownerId, input.operationId)) ??
    (await prepareCopyReservation(ownerId, input, origin));
  if (
    saved.copy.sourceConversationId !== input.sourceConversationId ||
    saved.conversation.initialModelId !== input.modelId
  ) {
    throw new CreationConflictError(
      "This copy operation already has different source or model settings."
    );
  }
  if (saved.copy.phase === "rejected") {
    await deleteUnacceptedEveCopy(ownerId, saved.conversation.id);
    throw new CreationConflictError("This saved copy was rejected.");
  }
  if (["deleting", "deleted"].includes(saved.conversation.state)) {
    throw new CreationConflictError("This saved copy is unavailable.");
  }
  const { id } = saved.conversation;
  if (saved.copy.phase === "preparing") {
    if (!saved.copy.plan) {
      throw new Error("Copy preparation is unavailable.");
    }
    try {
      for (const file of saved.copy.plan.files) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Accept each reserved destination file through writeEveCopyFile before reading/uploading another; a failed copy must stop before dispatch and bounds live byte buffers.
        await writeEveCopyFile(ownerId, id, file.key, {
          readSourceFile: downloadFile,
          writeDestinationFile: async (key, blob): Promise<void> => {
            await uploadFileAtKey(key, key, blob, blob.type);
          },
        });
      }
      await writeEveCopyDocuments(ownerId, id);
      await acceptEveCopy(ownerId, id);
    } catch (error) {
      if (error instanceof EveCopySourceChangedError) {
        await deleteUnacceptedEveCopy(ownerId, id);
      }
      throw error;
    }
  }
  return await dispatchEveCopy(
    ownerId,
    id,
    async (operationId) =>
      await createNativeEveCopy(ownerId, operationId, input.modelId)
  );
};
