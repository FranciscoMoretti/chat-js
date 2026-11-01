import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { z } from "zod";
import { getEveResponseGroup } from "@/lib/db/eve-response-groups";
import { resolveEvePrincipal } from "@/lib/eve/principal";

export const GET = async (
  request: ReadonlyNativeSurface<Pick<Request, "headers">>,
  {
    params,
  }: {
    readonly params: Readonly<
      Promise<{
        readonly id: string;
      }>
    >;
  }
): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { status: 401 });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 404 });
  }
  const group = await getEveResponseGroup(principal.ownerId, id);

  if (group) {
    return Response.json(group, {
      headers: { "cache-control": "private, no-store" },
    });
  }
  return new Response(null, { status: 404 });
};
