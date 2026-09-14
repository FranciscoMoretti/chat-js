import { isEveFileUnavailable } from "@/lib/db/eve-files";
import { env } from "@/lib/env";
import { createFileContentResponse } from "@/lib/file-content-response";
import { keyFromFileUrl } from "@/lib/file-url";

export const GET = async (request: Request) => {
  const key = keyFromFileUrl(request.url);
  if (env.WORKFLOW_POSTGRES_URL && key && (await isEveFileUnavailable(key))) {
    return new Response("File not found", {
      headers: { "Cache-Control": "private, no-store" },
      status: 404,
    });
  }
  return await createFileContentResponse(request);
};
