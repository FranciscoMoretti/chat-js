import { eveCreateOperationToken } from "./operation-token";
import { GET } from "eve/channels";
import { authenticateEveGateway } from "./gateway-auth";

/** Positive-only application route using eve 0.80.1's native continuation resolver. */
export const eveOperationLookupRoute = GET(
  "/eve/v1/operation/:operationId",
  async (request, { params, resolveSession }) => {
    const auth = await authenticateEveGateway(request);
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const query = new URL(request.url).searchParams;
    const kind = query.get("kind");
    if (
      !params.operationId ||
      [...query.keys()].some((key) => key !== "kind") ||
      query.getAll("kind").length > 1 ||
      (kind !== null && kind !== "seed")
    ) {
      return Response.json(
        { error: "Invalid operation lookup" },
        { status: 400 }
      );
    }
    const session = await resolveSession(
      eveCreateOperationToken(auth, params.operationId, kind === "seed")
    );
    return session
      ? Response.json(
          { sessionId: session.id },
          { headers: { "cache-control": "no-store" } }
        )
      : Response.json(
          { code: "eve_operation_unresolved" },
          { status: 409, headers: { "cache-control": "no-store" } }
        );
  }
);
