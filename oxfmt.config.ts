import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

/* oxlint-disable import/no-default-export -- oxfmt.config.ts: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
/* oxlint-disable oxc/no-rest-spread-properties -- oxfmt.config.ts: Fresh object composition preserves immutable state/configuration and existing override order. */
export default defineConfig({
  ...ultracite,
  // These generated indexes have content hashes checked by chat-js sync.
  // Reformatting their bodies invalidates the guard against overwriting user edits.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "examples/**",
    "**/composer-icons.generated.ts",
    "**/.eve/**",
    "**/tests/eve-results/**",
    // The model catalog is generator-owned; avoid unrelated snapshot churn.
    "**/lib/ai/models.generated.ts",
    "**/tools/chatjs/{tools,ui,providers,code-executor,workflow-types,tool-availability,document-ui,document-run,installed-features,composer-tools,search-config,code-execution-config,url-retrieval-config,image-generation-config,video-generation-config}.ts",
  ],
});
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable import/no-default-export */
