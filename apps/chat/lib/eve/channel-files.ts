import type { EveChannelInput } from "eve/channels/eve";
import { assertEveFilesOwned } from "@/lib/db/eve-files";
import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
import { retainWorkspaceAttachment } from "./workspace-attachments";

type FileContext = NonNullable<
  Parameters<NonNullable<EveChannelInput["fetchFile"]>>[1]
>;

/** Interpret owned storage keys locally; never fetch the URL's hostname.
 * @param {string} url Attachment URL used only to extract a recognized stored-file identity.
 * @param {FileContext} [context] Native file-fetch context supplying the session's current authenticated owner.
 * @returns {Promise<{ bytes: Buffer; mediaType: string } | null>} Authorized stored bytes and MIME type, or null for an unrecognized storage-key URL. Recognized keys require an authenticated owner and pass the ownership check before storage is read.
 */
export const fetchEveChannelFile = async (
  url: string,
  context?: {
    readonly session?: {
      readonly id: string;
      readonly auth: Pick<
        NonNullable<FileContext["session"]>["auth"],
        "current"
      >;
    };
  }
): Promise<{ bytes: Buffer; mediaType: string } | null> => {
  const key = keyFromFileUrl(url);
  if (key === null) {
    return null;
  }
  const auth = context?.session?.auth.current;
  if (
    auth === null ||
    typeof auth !== "object" ||
    auth.principalType === "anonymous"
  ) {
    throw new Error("Attachment resolution requires an authenticated owner.");
  }
  await assertEveFilesOwned(auth.principalId, [key]);
  const file = await downloadFile(key);
  const bytes = Buffer.from(await file.arrayBuffer());
  const sessionId = context?.session?.id;
  if (sessionId === undefined || sessionId === "") {
    throw new Error("Attachment session is unavailable.");
  }
  await retainWorkspaceAttachment({
    ownerId: auth.principalId,
    sessionId,
    fileKey: key,
    content: bytes,
  });
  return {
    bytes,
    mediaType: file.type,
  };
};
