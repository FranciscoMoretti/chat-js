import { expect, it } from "vitest";
import { z } from "zod";
import { validateToolDefinitions } from "@/chatjs/core/tools/tool-definition";
import {
  eveMessageTool,
  eveToolMetadata,
} from "@/lib/eve/message-tool-selection";

it("keeps concrete schemas and rejects ambiguous definition identities", () => {
  const tool = {
    name: "summarizeNotes",
    description: "Summarize notes",
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
    selectable: true,
  };
  expect(validateToolDefinitions([tool])[0]).toBe(tool);
  expect(tool.inputSchema.safeParse({ text: 42 }).success).toBe(false);
  expect(() => validateToolDefinitions([tool, tool])).toThrow(
    "Duplicate tool definition"
  );
});
it("retains a removed custom tool identity in historical messages", () => {
  expect(
    eveMessageTool({
      metadata: { custom: eveToolMetadata("removedCustomTool") },
    })
  ).toBe("removedCustomTool");
});
