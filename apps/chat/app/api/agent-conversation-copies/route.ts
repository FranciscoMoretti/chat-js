import { auth } from "@/lib/auth";
import { getEveCreation } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { eveCopyInput } from "@/lib/eve/copy-input";
import { EveCopyNotReadyError } from "@/lib/eve/copy-transcript";
import { sameOrigin } from "@/lib/eve/request-policy";
import { saveEveCopyOperation } from "@/lib/eve/save-copy-operation";

const headers = { "cache-control": "no-store" };

const readCopyBody = async (request: Request): Promise<unknown> => {
  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
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
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return null;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Cancellation can reject after the body stream fails.
    }
    reader.releaseLock();
  }
};

export const POST = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(null, { headers, status: 401 });
  }
  const { origin } = new URL(env.APP_URL ?? request.url);
  if (!sameOrigin(request, origin)) {
    return new Response(null, { headers, status: 403 });
  }
  const input = eveCopyInput.safeParse(await readCopyBody(request));
  if (!input.success) {
    return Response.json(
      { error: "Invalid copy request." },
      { headers, status: 400 }
    );
  }
  try {
    return Response.json(
      await saveEveCopyOperation(session.user.id, input.data, origin),
      { headers }
    );
  } catch (error) {
    let existing;
    try {
      existing = await getEveCreation(session.user.id, input.data.operationId);
    } catch {
      existing = undefined;
    }
    const rejected =
      existing &&
      (existing.creationKind !== "copy" ||
        ["deleting", "deleted"].includes(existing.state));
    let message = "Saving is unconfirmed. Retry to recover the same copy.";
    if (error instanceof EveCopyNotReadyError) {
      ({ message } = error);
    }
    if (rejected) {
      message = "This copy is no longer available.";
    }
    return Response.json(
      {
        conversationId:
          existing?.creationKind === "copy" ? existing.id : undefined,
        error: message,
        retryable: !rejected,
      },
      { headers, status: rejected ? 409 : 503 }
    );
  }
};
