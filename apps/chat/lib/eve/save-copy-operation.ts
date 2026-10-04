/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "../db/eve-copy-dispatch" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
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
import { readPublicEveCopyFile } from "@/lib/db/eve-copy-source-file";
import { CreationConflictError } from "@/lib/db/eve-queries";
import { downloadFile, uploadFileAtKey } from "@/lib/file-storage";

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
/* oxlint-enable import/max-dependencies */

/* oxlint-disable max-statements, typescript/promise-function-async --
 * max-statements (#512): prepareCopyReservation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): prepareCopyReservation preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): saveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): saveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): saveEveCopyOperation accepts blob; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): saveEveCopyOperation preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/**
 * Saves an idle native copy under one durable operation; billing begins on its first model turn.
 * @param ownerId Owner whose reservation, attachments, and copied conversation are used.
 * @param input Source/model request checked against any previous reservation for this operation.
 * @param origin Origin used to resolve public source resources while preparing the copy plan.
 * @returns The dispatched copy binding after owned files/documents have been accepted.
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
        // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
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
  return await dispatchEveCopy(ownerId, id, (operationId) =>
    createNativeEveCopy(ownerId, operationId, input.modelId)
  );
};
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
