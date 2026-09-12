import { auth } from "@/lib/auth";
import { getEveCreation } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { eveCopyInput } from "@/lib/eve/copy-input";
import { EveCopyNotReady } from "@/lib/eve/copy-transcript";
import { sameOrigin } from "@/lib/eve/request-policy";
import { saveEveCopyOperation } from "@/lib/eve/save-copy-operation";

const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404, headers });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(null, { status: 401, headers });
  }
  const origin = new URL(env.APP_URL ?? request.url).origin;
  if (!sameOrigin(request, origin)) {
    return new Response(null, { status: 403, headers });
  }
  const input = eveCopyInput.safeParse(await readCopyBody(request));
  if (!input.success) {
    return Response.json(
      { error: "Invalid copy request." },
      { status: 400, headers }
    );
  }
  try {
    return Response.json(
      await saveEveCopyOperation(session.user.id, input.data, origin),
      { headers }
    );
  } catch (error) {
    const existing = await getEveCreation(
      session.user.id,
      input.data.operationId
    ).catch(() => undefined);
    const rejected =
      existing &&
      (existing.creationKind !== "copy" ||
        ["deleting", "deleted"].includes(existing.state));
    let message = "Saving is unconfirmed. Retry to recover the same copy.";
    if (error instanceof EveCopyNotReady) {
      message = error.message;
    }
    if (rejected) {
      message = "This copy is no longer available.";
    }
    return Response.json(
      {
        error: message,
        retryable: !rejected,
        conversationId:
          existing?.creationKind === "copy" ? existing.id : undefined,
      },
      { status: rejected ? 409 : 503, headers }
    );
  }
}

async function readCopyBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      length += result.value.byteLength;
      if (length > 2048) {
        return null;
      }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
