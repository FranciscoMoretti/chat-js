import { z } from "zod";
import { auth } from "@/lib/auth";
import { getEveResponseGroup } from "@/lib/db/eve-response-groups";
import { isEveEnabled } from "@/lib/eve/availability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(null, { status: 401 });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 404 });
  }
  const group = await getEveResponseGroup(session.user.id, id);
  return group
    ? Response.json(group, {
        headers: { "cache-control": "private, no-store" },
      })
    : new Response(null, { status: 404 });
}
