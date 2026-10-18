import { POST } from "eve/channels";
import { manageLocalMicrosandboxResources } from "eve/sandbox/microsandbox";
import { z } from "zod";
import { authenticateEveGateway } from "./gateway-auth";

const resourceRequest = z.strictObject({
  expectedAppRoot: z.string().min(1).max(4096),
  action: z.enum(["retire", "purge"]),
});

const MAX_RESOURCE_REQUEST_BYTES = 8192;

const readResourceRequest = async (
  request: Request
): Promise<z.output<typeof resourceRequest> | null> => {
  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound each incoming chunk before accepting the next one.
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      size += chunk.value.byteLength;
      if (size > MAX_RESOURCE_REQUEST_BYTES) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Stop consuming the oversized body immediately.
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const parsed = resourceRequest.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf-8"))
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** Internal deletion route; cache authority is supplied by the native worker. */
export const eveLocalResourceRoute = POST(
  "/eve/v1/session/:sessionId/local-resources",
  async (request, context) => {
    if (request.headers.get("x-chatjs-deletion") !== "1") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const auth = await authenticateEveGateway(request);
    const { sessionId } = context.params;
    if (!auth || !sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const input = await readResourceRequest(request);
    if (input === null) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    const result = await manageLocalMicrosandboxResources(context, {
      ...input,
      sessionId,
    });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  }
);
