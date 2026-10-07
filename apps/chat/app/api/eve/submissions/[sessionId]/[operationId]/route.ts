/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-statements: Keep the transaction or boundary scenario ordered; splitting its statements would hide the evidence transition.
 * no-magic-numbers: Protocol statuses, array positions and deterministic scenario counts are local to this boundary.
 * no-undefined: Undefined represents absent stream evidence or an optional query result; null is a persisted value.
 * typescript/prefer-readonly-parameter-types: The Drizzle, EVE and Web Streams callbacks retain their SDK parameter types; the boundary does not mutate event data.
 * unicorn/no-null: Explicit null represents the stored no-tool selection or an empty HTTP body, not missing evidence.
 */
import { Client } from "eve/client";
import { z } from "zod";

import { readEveSubmission } from "@/lib/db/queries";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { projectEveSubmissionEvents } from "@/lib/eve/submission-projection";

const GET = async (
  request: Request,
  context: { params: Promise<{ sessionId: string; operationId: string }> }
): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (principal === null) {
    return new Response(null, { status: 401 });
  }
  const { sessionId, operationId } = await context.params;
  if (!z.uuid().safeParse(operationId).success) {
    return new Response(null, { status: 404 });
  }
  const submission = await readEveSubmission(
    principal.ownerId,
    sessionId,
    operationId
  );
  if (submission === undefined) {
    return new Response(null, { status: 404 });
  }
  try {
    const client = new Client(getEveConnectionOptions(principal.ownerId));
    const snapshot = await client.sessions
      .attach(sessionId)
      .snapshot({ signal: AbortSignal.timeout(15_000) });
    await projectEveSubmissionEvents(
      principal.ownerId,
      sessionId,
      snapshot.events
    );
  } catch {
    // An unreadable stream does not change the previously recorded evidence.
  }
  const current = await readEveSubmission(
    principal.ownerId,
    sessionId,
    operationId
  );
  if (current === undefined) {
    return new Response(null, { status: 404 });
  }
  return Response.json(
    { messageId: current.messageId, operationId, state: current.state },
    { headers: { "cache-control": "no-store" } }
  );
};
export { GET };

/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */
