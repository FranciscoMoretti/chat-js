import { dispatchEveCopy } from "../db/eve-copy-dispatch";
import { snapshotPublicEveCopyDocuments } from "../db/eve-copy-documents";
import {
  EveCopySourceChanged,
  getEveCopyOperation,
  reserveEveCopyOperation,
} from "../db/eve-copy-journal";
import {
  acceptEveCopy,
  writeEveCopyDocuments,
  writeEveCopyFile,
} from "../db/eve-copy-resources";
import { readPublicEveCopyFile } from "../db/eve-copy-source-file";
import { CreationConflict } from "../db/eve-queries";
import { downloadFile, uploadFileAtKey } from "../file-storage";
import { createNativeEveCopy } from "./create-native-copy";
import { deleteUnacceptedEveCopy } from "./delete-unaccepted-copy";
import { loadEveModelDefinition } from "./model-selection";
import { prepareEveCopyPlan } from "./prepare-copy-plan";
import { readPublicEveCopySource } from "./public-copy-source";
import { assertEveConfigured } from "./server";

/** Saving is idle: billing admission happens on the first actual model turn. */
export async function saveEveCopyOperation(
  ownerId: string,
  input: { sourceConversationId: string; operationId: string; modelId: string },
  origin: string
) {
  assertEveConfigured();
  let saved = await getEveCopyOperation(ownerId, input.operationId);
  if (!saved) {
    await loadEveModelDefinition(input.modelId);
    const source = await readPublicEveCopySource(input.sourceConversationId);
    const documents = await snapshotPublicEveCopyDocuments(
      source.id,
      source.sessionId,
      source.projection.resources
    );
    const plan = await prepareEveCopyPlan(
      source.projection,
      documents,
      (key) => readPublicEveCopyFile(source, key, downloadFile),
      origin
    );
    try {
      saved = await reserveEveCopyOperation(ownerId, {
        ...input,
        sourceOwnerId: source.ownerId,
        sourceSessionId: source.sessionId,
        projectionHash: source.projection.projectionHash,
        title: source.title,
        plan,
      });
    } catch (error) {
      // Concurrent preparations choose one durable allocation. Recover a lost reservation reply too.
      saved = await getEveCopyOperation(ownerId, input.operationId);
      if (!saved) {
        throw error;
      }
    }
  }
  if (
    saved.copy.sourceConversationId !== input.sourceConversationId ||
    saved.conversation.initialModelId !== input.modelId
  ) {
    throw new CreationConflict(
      "This copy operation already has different source or model settings."
    );
  }
  if (saved.copy.phase === "rejected") {
    await deleteUnacceptedEveCopy(ownerId, saved.conversation.id);
    throw new CreationConflict("This saved copy was rejected.");
  }
  if (["deleting", "deleted"].includes(saved.conversation.state)) {
    throw new CreationConflict("This saved copy is unavailable.");
  }
  const id = saved.conversation.id;
  if (saved.copy.phase === "preparing") {
    if (!saved.copy.plan) {
      throw new Error("Copy preparation is unavailable.");
    }
    try {
      for (const file of saved.copy.plan.files) {
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
      if (error instanceof EveCopySourceChanged) {
        await deleteUnacceptedEveCopy(ownerId, id);
      }
      throw error;
    }
  }
  return await dispatchEveCopy(ownerId, id, (operationId) =>
    createNativeEveCopy(ownerId, operationId, input.modelId)
  );
}
