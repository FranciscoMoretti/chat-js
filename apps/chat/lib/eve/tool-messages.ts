import type { ModelMessage } from "ai";
import { defineState } from "eve/context";
import { parse } from "superjson";

// Persist only data; native tool definitions and resource handles are never captured.
export const eveToolMessages = defineState<string>(
  "chatjs.tool-messages",
  () => ""
);
export const getToolMessages = (): ModelMessage[] => {
  const serialized = eveToolMessages.get();
  return serialized ? parse<ModelMessage[]>(serialized) : [];
};
