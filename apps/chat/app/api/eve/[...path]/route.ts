import { auth } from "@/lib/auth";
import { canSpend } from "@/lib/db/credits";
import { ownsEveSession } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";

async function checkTurnAdmission(isNewMessage: boolean, ownerId: string) {
  if (!isNewMessage) {
    return;
  }
  await reconcileEveOwnerUsage(ownerId);
  if (!(await canSpend(ownerId))) {
    return Response.json({ error: "Insufficient credits" }, { status: 402 });
  }
}

async function readCommand(
  request: Request,
  policy: NonNullable<ReturnType<typeof parseSessionRequest>>
) {
  let body: string | undefined;
  let isNewMessage = false;
  let modelId: string | undefined;
  if (request.method === "POST") {
    const input = policy.schema.safeParse(
      await request.json().catch(() => null)
    );
    if (!input.success) {
      return new Response(null, { status: 400 });
    }
    if ("message" in input.data) {
      const selectedModel = request.headers.get("x-chatjs-selected-model");
      if (
        selectedModel &&
        input.data.modelId &&
        selectedModel !== input.data.modelId
      ) {
        return new Response(null, { status: 400 });
      }
      modelId = selectedModel ?? input.data.modelId;
      try {
        await loadEveModelDefinition(modelId);
      } catch {
        return Response.json(
          { error: "This model is not available for chat." },
          { status: 400 }
        );
      }
      body = JSON.stringify({ message: input.data.message });
    } else {
      body = JSON.stringify(input.data);
    }
    isNewMessage = "message" in input.data;
  }
  return { body, isNewMessage, modelId };
}

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(null, { status: 401 });
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const { path } = await context.params;
  const upstreamPath = `/eve/${path.join("/")}`;
  const policy = parseSessionRequest(upstreamPath, request.method);
  if (!(policy && (await ownsEveSession(session.user.id, policy.sessionId)))) {
    return new Response(null, { status: 404 });
  }
  const query = safeStreamQuery(new URL(request.url).searchParams);
  if (!query || (request.method !== "GET" && query.size)) {
    return new Response(null, { status: 400 });
  }
  const command = await readCommand(request, policy);
  if (command instanceof Response) {
    return command;
  }
  const { body, isNewMessage, modelId } = command;
  try {
    const admission = await checkTurnAdmission(isNewMessage, session.user.id);
    if (admission) {
      return admission;
    }
    const result = await eveRequest(
      session.user.id,
      upstreamPath + (query.size ? `?${query}` : ""),
      {
        method: request.method,
        body,
        // Closing the reader must not cancel a validated command before Eve
        // can durably accept it. Streaming reads still follow browser lifetime.
        signal:
          request.method === "GET"
            ? request.signal
            : AbortSignal.timeout(30_000),
      },
      modelId
    );
    const headers = new Headers({ "cache-control": "no-store" });
    for (const key of [
      "content-type",
      "x-eve-session-id",
      "x-eve-stream-format",
      "x-eve-stream-version",
      "x-eve-stream-tail-index",
    ]) {
      const value = result.headers.get(key);
      if (value) {
        headers.set(key, value);
      }
    }
    return new Response(result.body, { status: result.status, headers });
  } catch {
    return Response.json(
      {
        error:
          "The agent connection was interrupted. Reconnect before retrying.",
      },
      { status: 502 }
    );
  }
}
export const GET = handle;
export const POST = handle;
