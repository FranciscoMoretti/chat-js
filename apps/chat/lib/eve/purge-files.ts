import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
} from "../db/eve-file-purge";
import { deleteFilesByUrls } from "../file-storage";
import { createFileUrl } from "../file-url";

/** Internal deletion stage; requires native retirement/accounting settlement or never-dispatched copy proof. */
export const purgeEveFamilyFiles = async (ownerId: string, rootId: string) => {
  const keys = await prepareEveFamilyFilePurge(ownerId, rootId);
  if (keys.length) {
    await deleteFilesByUrls(keys.map((key) => createFileUrl(key)));
    await completeEveFilePurge(ownerId, keys);
  }
  await releaseEveFamilyFileReferences(ownerId, rootId);
};
