import { canReadEveFile } from "@/lib/db/eve-files";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { createFileContentResponse } from "@/lib/file-content-response";
import { keyFromFileUrl } from "@/lib/file-url";

export const GET = async (request: Request) => {
  const key = keyFromFileUrl(request.url);
  if (!key) {
    return await createFileContentResponse(request);
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
  return await createFileContentResponse(request, {
    allowRedirect: !access.managed,
  });
};
