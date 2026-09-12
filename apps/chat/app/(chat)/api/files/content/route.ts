import { isEveFileUnavailable } from "@/lib/db/eve-files";
import { env } from "@/lib/env";
import { createFileContentResponse } from "@/lib/file-content-response";
import { keyFromFileUrl } from "@/lib/file-url";

export async function GET(request: Request) {
  const key = keyFromFileUrl(request.url);
  if (env.WORKFLOW_POSTGRES_URL && key && (await isEveFileUnavailable(key))) {
    return new Response("File not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return await createFileContentResponse(request);
}
