// Server-side tools installed via `chatjs add`.
// This file is fully managed by the CLI — do not edit manually.
import {
  createRegistryTools,
  type ToolRuntimeContext,
} from "@/tools/chatjs/_shared/lib/runtime";

// [chatjs-registry:tool-imports]
import { generateImage } from "@/tools/chatjs/generate-image/tool";
import { generateVideo } from "@/tools/chatjs/generate-video/tool";
import { getWeather } from "@/tools/chatjs/get-weather/tool";
import { retrieveUrl } from "@/tools/chatjs/retrieve-url/tool";
import { wordCount } from "@/tools/chatjs/word-count/tool";
// [/chatjs-registry:tool-imports]

export const toolEntries = {
  // [chatjs-registry:tools]
  generateImage,
  generateVideo,
  getWeather,
  retrieveUrl,
  wordCount,
  // [/chatjs-registry:tools]
} as const;

export function createTools(ctx: ToolRuntimeContext) {
  return createRegistryTools(toolEntries, ctx);
}
