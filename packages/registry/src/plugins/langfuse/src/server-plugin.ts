import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { register } from "./instrumentation";

export const langfuse = () =>
  ({ id: "langfuse", instrumentation: register }) satisfies ChatPlugin;
