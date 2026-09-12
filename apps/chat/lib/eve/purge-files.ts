import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
} from "../db/eve-file-purge";
import { deleteFilesByUrls } from "../file-storage";
import { FILE_CONTENT_PATH } from "../file-url";

/** Internal deletion stage; requires native retirement/accounting settlement or never-dispatched copy proof. */
export async function purgeEveFamilyFiles(ownerId: string, rootId: string) {
  const keys = await prepareEveFamilyFilePurge(ownerId, rootId);
  if (keys.length) {
    await deleteFilesByUrls(
      keys.map((key) => `${FILE_CONTENT_PATH}?${new URLSearchParams({ key })}`)
    );
    await completeEveFilePurge(ownerId, keys);
  }
  await releaseEveFamilyFileReferences(ownerId, rootId);
}
