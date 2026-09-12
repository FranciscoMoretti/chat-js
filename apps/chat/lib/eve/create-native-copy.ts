import { z } from "zod";
import { eveRequest } from "./server";

/** Idempotent seed lookup/creation, without browser history or source capabilities. */
export async function createNativeEveCopy(
  ownerId: string,
  operationId: string,
  modelId: string
) {
  const existing = await eveRequest(
    ownerId,
    `/eve/v1/operation/${operationId}?kind=seed`,
    {
      signal: AbortSignal.timeout(15_000),
    }
  );
  const session = z.object({ sessionId: z.string().min(1) });
  if (existing.ok) {
    return session.parse(await existing.json()).sessionId;
  }
  const missing = z
    .object({ code: z.literal("eve_operation_not_found") })
    .safeParse(await existing.json().catch(() => null));
  if (existing.status !== 404 || !missing.success) {
    throw new Error("Native copy lookup is unavailable.");
  }
  const result = await eveRequest(
    ownerId,
    "/eve/v1/session",
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ seed: true, operationId }),
    },
    modelId
  );
  if (!result.ok) {
    throw new Error("Native copy creation is unresolved.");
  }
  return session.parse(await result.json()).sessionId;
}
