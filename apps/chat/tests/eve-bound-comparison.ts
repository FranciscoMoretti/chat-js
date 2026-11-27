import { expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import type { z } from "zod";

import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";
import type { eveResponseGroupInput } from "../lib/eve/response-group-input";

export const requestBoundComparison = async (
  request: Pick<APIRequestContext, "get" | "post">,
  origin: string,
  data: z.input<typeof eveResponseGroupInput>
): Promise<z.output<typeof eveResponseGroupResult>> => {
  const send = async () => {
    const response = await request.post("/api/agent-response-groups", {
      data,
      headers: { origin },
      timeout: 30_000,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return eveResponseGroupResult.parse(await response.json());
  };
  let result = await send();
  const { id } = result;
  const operationIds = result.candidates.map(
    (candidate) => candidate.operationId
  );
  const allBound = () => {
    const states = result.candidates.map((candidate) => candidate.state);
    expect(states).not.toContain("rejected");
    expect(states).not.toContain("unresolved");
    return states.every((state) => state === "bound");
  };
  if (!allBound()) {
    await expect
      .poll(
        async () => {
          result = await send();
          // A poll callback error ends the poll; only a false result is retried.
          expect(result.id).toBe(id);
          expect(
            result.candidates.map((candidate) => candidate.operationId)
          ).toEqual(operationIds);
          return allBound();
        },
        { intervals: [1000, 2000, 4000], timeout: 60_000 }
      )
      .toBe(true);
  }
  await Promise.all(
    result.candidates.flatMap((candidate) =>
      candidate.state === "bound"
        ? [
            expect
              .poll(
                async () => {
                  const stream = await request.get(
                    `/api/eve/v1/session/${candidate.sessionId}/stream?startIndex=0&includeTailIndex=1`,
                    { timeout: 15_000 }
                  );
                  expect(stream.ok(), await stream.text()).toBe(true);
                  return await stream.text();
                },
                { intervals: [1000, 2000], timeout: 45_000 }
              )
              .toContain("turn.settled"),
          ]
        : []
    )
  );
  return result;
};
