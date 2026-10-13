import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { z } from "zod";
import { isUnacceptedEveCopy } from "@/lib/db/eve-copy-journal";
import { deleteLocalEveConversationFamily } from "@/lib/eve/delete-local-conversation";
import { deleteUnacceptedEveCopy } from "@/lib/eve/delete-unaccepted-copy";
import { env } from "@/lib/env";
import { getEveDeletionState } from "@/lib/db/eve-deletion";
import { localDeletionAvailable } from "@/lib/eve/local-deletion-available";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";

const headers = { "cache-control": "no-store" };
interface Context {
  readonly params: Readonly<Promise<{ id: string }>>;
}

const authorize = async (
  request: ReadonlyNativeSurface<Pick<Request, "headers">>,
  context: Context
): Promise<
  | Response
  | {
      id: string;
      ownerId: string;
      source: NonNullable<Awaited<ReturnType<typeof getEveDeletionState>>>;
    }
> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { headers, status: 401 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { headers, status: 400 });
  }
  const source = await getEveDeletionState(principal.ownerId, id);
  if (!source) {
    return new Response(null, { headers, status: 404 });
  }
  return { id, ownerId: principal.ownerId, source };
};

const deletionStatus = (state: string): "deleted" | "pending" | "active" => {
  if (state === "deleted") {
    return "deleted";
  }
  if (state === "deleting") {
    return "pending";
  }
  return "active";
};

/**
 * Returns deletion status without resuming cleanup or exposing conversation payloads.
 * @param {Request} request Same-origin status request.
 * @param {Context} context Route parameters containing the conversation ID.
 * @returns {Promise<Response>} No-store JSON containing the conversation family root and status.
 */
const GET = async (
  request: ReadonlyNativeSurface<Request>,
  context: Context
): Promise<Response> => {
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
};
// Map the durable state after a failed erasure to the retry/status response.
const deletionRecoveryResponse = (
  current: ReadonlyNativeSurface<
    Awaited<ReturnType<typeof getEveDeletionState>>
  >
): Response => {
  if (current?.state === "deleted") {
    return Response.json(
      { rootId: current.rootId, status: "deleted" },
      { headers }
    );
  }
  if (current?.state === "deleting") {
    return Response.json(
      {
        error: "Deletion is incomplete. Retry to continue cleanup.",
        retryRequired: true,
        rootId: current.rootId,
        status: "pending",
      },
      { headers, status: 202 }
    );
  }
  return Response.json(
    {
      error: "Resolve pending conversation work before deleting.",
      status: "not_started",
    },
    { headers, status: 409 }
  );
};

/**
 * Deletes an owned conversation family through the local-provider coordinator.
 * Unaccepted copies are removed directly; accepted conversations are fenced and erased locally.
 * @param {Request} request Same-origin deletion request.
 * @param {Context} context Route parameters containing the conversation or chat ID.
 * @returns {Promise<Response>} No-store JSON with deletion status, or an error response.
 */
const DELETE = async (
  request: ReadonlyNativeSurface<Request>,
  context: Context
): Promise<Response> => {
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { headers, status: 403 });
  }
  const result = await authorize(request, context);
  if (result instanceof Response) {
    return result;
  }
  const { ownerId, id, source } = result;
  if (source.state === "deleted") {
    return Response.json(
      { rootId: source.rootId, status: "deleted" },
      { headers }
    );
  }
  try {
    if (await isUnacceptedEveCopy(ownerId, id)) {
      await deleteUnacceptedEveCopy(ownerId, id);
      return Response.json(
        { rootId: source.rootId, status: "deleted" },
        { headers }
      );
    }
    // Hosted native erasure is not implemented. Reject before revoking access.
    if (!localDeletionAvailable()) {
      return Response.json(
        { error: "Deletion is not available for this provider configuration." },
        { headers, status: 503 }
      );
    }
    const deleted = await deleteLocalEveConversationFamily(
      ownerId,
      id,
      process.cwd()
    );
    if (!deleted) {
      return new Response(null, { headers, status: 404 });
    }
    return Response.json(
      { rootId: deleted.rootId, status: "deleted" },
      { headers }
    );
  } catch {
    const current = await getEveDeletionState(ownerId, id);
    return deletionRecoveryResponse(current);
  }
};
export { DELETE, GET };
