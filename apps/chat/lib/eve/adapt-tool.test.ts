import { tool } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { describeEveTool } from "./adapt-tool";

describe("Eve tool contract", () => {
  it("removes executable schema metadata from the advertised JSON schema", async () => {
    const adapted = await describeEveTool(
      tool({
        description: "Count words",
        inputSchema: z.object({ text: z.string() }),
        execute: ({ text }) => text.length,
      })
    );
    expect(adapted.inputSchema).toMatchObject({
      type: "object",
      properties: { text: { type: "string" } },
    });
    expect(JSON.stringify(adapted.inputSchema)).not.toContain("~standard");
  });
  it("refuses to silently bypass an existing approval policy", async () => {
    await expect(
      describeEveTool(
        tool({
          description: "Protected",
          inputSchema: z.object({}),
          needsApproval: true,
          execute: () => "done",
        })
      )
    ).rejects.toThrow("explicit Eve policy");
  });
});
