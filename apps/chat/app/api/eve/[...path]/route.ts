import { auth } from "@/lib/auth";
import { ownsEveSession } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";

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
  let body: string | undefined;
  if (request.method === "POST") {
    const input = policy.schema.safeParse(
      await request.json().catch(() => null)
    );
    if (!input.success) {
      return new Response(null, { status: 400 });
    }
    body = JSON.stringify(input.data);
  }
  try {
    const result = await eveRequest(
      session.user.id,
      upstreamPath + (query.size ? `?${query}` : ""),
      { method: request.method, body, signal: request.signal }
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
