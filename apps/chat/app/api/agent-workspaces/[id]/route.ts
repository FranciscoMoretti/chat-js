import { z } from "zod";
import { readOwnedWorkspace } from "@/lib/db/eve-workspaces";
import { purgeEveWorkspaceFiles } from "@/lib/eve/purge-files";
import { env } from "@/lib/env";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
import { cleanupWorkspaceIfUnused } from "@/lib/eve/persistent-sandbox-store";
import { getPersistentSandboxProvider } from "@/lib/sandbox/runtime";

const headers = { "cache-control": "no-store" };

/** Delete an empty owned workspace; attached conversations must be deleted explicitly first. */
export const DELETE = async (
  request: Request,
  context: { readonly params: Promise<{ id: string }> }
): Promise<Response> => {
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { headers, status: 403 });
  }
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { headers, status: 401 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { headers, status: 400 });
  }
  const workspace = await readOwnedWorkspace(principal.ownerId, id);
  if (workspace === null) {
    return new Response(null, { headers, status: 404 });
  }
  try {
    await cleanupWorkspaceIfUnused(
      principal.ownerId,
      id,
      getPersistentSandboxProvider,
      true
    );
    await purgeEveWorkspaceFiles(principal.ownerId, id);
    return Response.json({ workspaceId: id, status: "deleted" }, { headers });
  } catch {
    return Response.json(
      {
        workspaceId: id,
        status: "blocked",
        error:
          "Workspace cleanup is incomplete. Delete attached conversations, resolve pending operations, and retry cleanup.",
      },
      { headers, status: 409 }
    );
  }
};
