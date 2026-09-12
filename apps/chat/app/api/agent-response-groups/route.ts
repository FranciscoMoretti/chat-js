import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { sameOrigin } from "@/lib/eve/request-policy";
import { createEveResponseGroup } from "@/lib/eve/response-group";
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";

export async function POST(request: Request) {
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
  const input = eveResponseGroupInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return Response.json(
      { error: "Invalid response group request." },
      { status: 400 }
    );
  }
  try {
    return Response.json(
      eveResponseGroupResult.parse(
        await createEveResponseGroup(session.user.id, input.data)
      )
    );
  } catch {
    return Response.json(
      {
        error:
          "Response group is unavailable or unresolved. Retain the original request before retrying.",
      },
      { status: 409 }
    );
  }
}
