import { canReadEveFile } from "./db/eve-files";
import { resolveEvePrincipal } from "./eve/principal";
import { createFileContentResponse } from "./file-content-response";
import { isFileStorageKey } from "./file-url";

export const createFileAccessResponse = async (
  request: Request,
  key: string
) => {
  if (!isFileStorageKey(key)) {
    return new Response("Invalid file key", { status: 400 });
  }
  const principal = await resolveEvePrincipal(request.headers);
  const access = await canReadEveFile(key, principal?.ownerId);
  if (!access.allowed) {
    return new Response("File not found", {
      headers: { "Cache-Control": "private, no-store" },
      status: 404,
    });
  }
  // Managed files must stay behind this revocable authorization boundary.
  return await createFileContentResponse(request, key, {
    allowRedirect: !access.managed,
  });
};
