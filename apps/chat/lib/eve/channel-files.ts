import type { EveChannelInput } from "eve/channels/eve";

import { assertEveFilesOwned } from "../db/eve-files";
import { downloadFile } from "../file-storage";
import { keyFromFileUrl } from "../file-url";

type FileContext = Parameters<NonNullable<EveChannelInput["fetchFile"]>>[1];

/** Interpret owned storage keys locally; never fetch the URL's hostname. */
export const fetchEveChannelFile = async (
  url: string,
  context?: FileContext
) => {
  const key = keyFromFileUrl(url);
  if (!key) {
    return null;
  }
  const auth = context?.session?.auth.current;
  if (!auth || auth.principalType === "anonymous") {
    throw new Error("Attachment resolution requires an authenticated owner.");
  }
  await assertEveFilesOwned(auth.principalId, [key]);
  const file = await downloadFile(key);
  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    mediaType: file.type,
  };
};
