import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // These generated indexes have content hashes checked by chat-js sync.
  // Reformatting their bodies invalidates the guard against overwriting user edits.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/tools/chatjs/{tools,ui,search-config,code-execution-config,url-retrieval-config,image-generation-config,video-generation-config}.ts",
  ],
});
