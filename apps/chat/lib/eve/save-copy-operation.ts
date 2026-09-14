import { dispatchEveCopy } from "../db/eve-copy-dispatch";
import { snapshotPublicEveCopyDocuments } from "../db/eve-copy-documents";
import {
  EveCopySourceChangedError,
  getEveCopyOperation,
  rejectEveCopyPreflight,
  reserveEveCopyOperation,
} from "../db/eve-copy-journal";
import {
  acceptEveCopy,
  writeEveCopyDocuments,
  writeEveCopyFile,
} from "../db/eve-copy-resources";
import { readPublicEveCopyFile } from "../db/eve-copy-source-file";
import { CreationConflictError } from "../db/eve-queries";
import { downloadFile, uploadFileAtKey } from "../file-storage";
import type { EveCopyInput } from "./copy-input";
import { createNativeEveCopy } from "./create-native-copy";
import { deleteUnacceptedEveCopy } from "./delete-unaccepted-copy";
import {
  EveModelUnavailableError,
  loadEveModelDefinition,
} from "./model-selection";
import { prepareEveCopyPlan } from "./prepare-copy-plan";
import { readPublicEveCopySource } from "./public-copy-source";
import { assertEveConfigured } from "./server";

const prepareCopyReservation = async (
  ownerId: string,
  input: EveCopyInput,
  origin: string
) => {
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
    (key) => readPublicEveCopyFile(source, key, downloadFile),
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

/** Saving is idle: billing admission happens on the first actual model turn. */
export const saveEveCopyOperation = async (
  ownerId: string,
  input: EveCopyInput,
  origin: string
) => {
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
        // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
        await writeEveCopyFile(ownerId, id, file.key, {
          readSourceFile: downloadFile,
          writeDestinationFile: async (key, blob) => {
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
  return await dispatchEveCopy(ownerId, id, (operationId) =>
    createNativeEveCopy(ownerId, operationId, input.modelId)
  );
};
