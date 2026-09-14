import { z } from "zod";

import { getEveResponseGroup } from "@/lib/db/eve-response-groups";
import { resolveEvePrincipal } from "@/lib/eve/principal";

export const GET = async (
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { status: 401 });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 404 });
  }
  const group = await getEveResponseGroup(principal.ownerId, id);
  return group
    ? Response.json(group, {
        headers: { "cache-control": "private, no-store" },
      })
    : new Response(null, { status: 404 });
};
