/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "../db/eve-copy-dispatch" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-copy-dispatch"; "../db/eve-copy-documents"; "../db/eve-copy-journal"; "../db/eve-copy-resources"; "../db/eve-copy-source-file" dependency within this package instead of introducing an alias or barrel API.
 */
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
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

/* oxlint-disable max-statements, typescript/explicit-function-return-type, typescript/promise-function-async --
 * max-statements (#512): prepareCopyReservation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep prepareCopyReservation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): prepareCopyReservation preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
/* oxlint-enable max-statements, typescript/explicit-function-return-type, typescript/promise-function-async */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * jsdoc/require-param (#534): saveEveCopyOperation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): saveEveCopyOperation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): saveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): saveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep saveEveCopyOperation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep saveEveCopyOperation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): saveEveCopyOperation accepts blob; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): saveEveCopyOperation preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
