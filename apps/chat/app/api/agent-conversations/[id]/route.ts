import { z } from "zod";
import { auth } from "@/lib/auth";
import { getEveDeletionState } from "@/lib/db/eve-deletion";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { deleteLocalEveConversationFamily } from "@/lib/eve/delete-local-conversation";
import { sameOrigin } from "@/lib/eve/request-policy";

const headers = { "cache-control": "no-store" };
type Context = { params: Promise<{ id: string }> };

async function authorize(request: Request, context: Context) {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404, headers });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(null, { status: 401, headers });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 400, headers });
  }
  const source = await getEveDeletionState(session.user.id, id);
  if (!source) {
    return new Response(null, { status: 404, headers });
  }
  return { ownerId: session.user.id, id, source };
}

/** Status only; reading never resumes deletion or exposes conversation payloads. */
export async function GET(request: Request, context: Context) {
  const result = await authorize(request, context);
  if (result instanceof Response) {
    return result;
  }
  return Response.json(
    {
      rootId: result.source.rootId,
      status: deletionStatus(result.source.state),
    },
    { headers }
  );
}

function localDeletionAvailable() {
  try {
    const local = new Set(["localhost", "127.0.0.1", "[::1]"]);
    const world = new URL(env.WORKFLOW_POSTGRES_URL ?? "");
    const worker = new URL(env.EVE_INTERNAL_ORIGIN ?? "");
    return (
      ["postgres:", "postgresql:"].includes(world.protocol) &&
      local.has(world.hostname) &&
      ["http:", "https:"].includes(worker.protocol) &&
      local.has(worker.hostname)
    );
  } catch {
    return false;
  }
}

/** Erases the conversation family through the verified local-provider coordinator. */
export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403, headers });
  }
  const result = await authorize(request, context);
  if (result instanceof Response) {
    return result;
  }
  const { ownerId, id, source } = result;
  if (source.state === "deleted") {
    return Response.json(
      { status: "deleted", rootId: source.rootId },
      { headers }
    );
  }
  // Hosted-provider erasure is not implemented. Reject before revoking access.
  if (!localDeletionAvailable()) {
    return Response.json(
      { error: "Deletion is not available for this provider configuration." },
      { status: 503, headers }
    );
  }
  try {
    const deleted = await deleteLocalEveConversationFamily(
      ownerId,
      id,
      process.cwd()
    );
    if (!deleted) {
      return new Response(null, { status: 404, headers });
    }
    return Response.json(
      { status: "deleted", rootId: deleted.rootId },
      { headers }
    );
  } catch {
    const current = await getEveDeletionState(ownerId, id);
    if (current?.state === "deleted") {
      return Response.json(
        { status: "deleted", rootId: current.rootId },
        { headers }
      );
    }
    if (current?.state === "deleting") {
      return Response.json(
        {
          status: "pending",
          rootId: current.rootId,
          retryRequired: true,
          error: "Deletion is incomplete. Retry to continue cleanup.",
        },
        { status: 202, headers }
      );
    }
    return Response.json(
      {
        status: "not_started",
        error: "Resolve pending conversation work before deleting.",
      },
      { status: 409, headers }
    );
  }
}

function deletionStatus(state: string) {
  if (state === "deleted") {
    return "deleted";
  }
  if (state === "deleting") {
    return "pending";
  }
  return "active";
}
