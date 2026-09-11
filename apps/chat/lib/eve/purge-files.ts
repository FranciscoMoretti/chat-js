import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
} from "../db/eve-file-purge";
import { deleteFilesByUrls } from "../file-storage";
import { FILE_CONTENT_PATH } from "../file-url";

/** Internal deletion stage; native retirement and accounting settlement must precede it. */
export async function purgeEveFamilyFiles(ownerId: string, rootId: string) {
  const keys = await prepareEveFamilyFilePurge(ownerId, rootId);
  if (!keys.length) {
    return;
  }
  await deleteFilesByUrls(
    keys.map((key) => `${FILE_CONTENT_PATH}?${new URLSearchParams({ key })}`)
  );
  await completeEveFilePurge(ownerId, keys);
}
