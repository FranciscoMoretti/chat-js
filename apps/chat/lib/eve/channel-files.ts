import type { EveChannelInput } from "eve/channels/eve";
import { assertEveFilesOwned } from "@/lib/db/eve-files";
import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): The native fetchFile callback takes URL first and context second; index 1 selects that SDK parameter without duplicating its type.
 */
type FileContext = Parameters<NonNullable<EveChannelInput["fetchFile"]>>[1];
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (fetchEveChannelFile); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchEveChannelFile's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): fetchEveChannelFile preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Interpret owned storage keys locally; never fetch the URL's hostname.
 * @param {string} url Attachment URL used only to extract a recognized stored-file identity.
 * @param {FileContext} [context] Native file-fetch context supplying the session's current authenticated owner.
 * @returns {Promise<{ bytes: Buffer; mediaType: string } | null>} Authorized stored bytes and MIME type, or null for an unrecognized storage-key URL. Recognized keys require an authenticated owner and pass the ownership check before storage is read.
 */
export const fetchEveChannelFile = async (
  url: string,
  context?: FileContext
): Promise<{ bytes: Buffer; mediaType: string } | null> => {
  const key = keyFromFileUrl(url);
  if (key === null) {
    return null;
  }
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading auth from context.session; read session from context; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    mediaType: file.type,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
