import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { getEveCreation } from "@/lib/db/eve-queries";
import { eveCopyInput } from "@/lib/eve/copy-input";
import { EveCopyNotReadyError } from "@/lib/eve/copy-transcript";
import { sameOrigin } from "@/lib/eve/request-policy";
import { saveEveCopyOperation } from "@/lib/eve/save-copy-operation";

const MAX_COPY_BODY_BYTES = 2048;
const COPY_UNAVAILABLE_STATUS = 409;
const COPY_UNCONFIRMED_STATUS = 503;

const headers = { "cache-control": "no-store" };

const readCopyBody = async (
  request: ReadonlyNativeSurface<Pick<Request, "body">>
): Promise<unknown> => {
  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      // oxlint-disable-next-line no-await-in-loop -- Check each chunk against the byte limit before requesting another; finally cancels the reader on overflow or error.
      const result = await reader.read();
      if (result.done) {
        break;
      }
      length += result.value.byteLength;
      if (length > MAX_COPY_BODY_BYTES) {
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

// Map recovery state without rereading the session, request, or input boundary.
const copyFailureResponse = (
  error: unknown,
  existing:
    | ReadonlyNativeSurface<Awaited<ReturnType<typeof getEveCreation>>>
    | undefined
): Response => {
  const rejected = Boolean(
    existing &&
    (existing.creationKind !== "copy" ||
      ["deleting", "deleted"].includes(existing.state))
  );
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
    {
      headers,
      status: rejected ? COPY_UNAVAILABLE_STATUS : COPY_UNCONFIRMED_STATUS,
    }
  );
};

export const POST = async (
  request: ReadonlyNativeSurface<Request>
): Promise<Response> => {
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
    return copyFailureResponse(error, existing);
  }
};
