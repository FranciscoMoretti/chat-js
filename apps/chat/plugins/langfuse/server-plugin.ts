import type { ChatPlugin } from "@/lib/plugin-contracts";
import { register } from "./instrumentation";

export const langfuse = () =>
  ({ id: "langfuse", instrumentation: register }) satisfies ChatPlugin;
