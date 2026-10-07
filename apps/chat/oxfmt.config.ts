import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default defineConfig({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing ultracite own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...ultracite,
  // These generated indexes have content hashes checked by chat-js sync.
  // Reformatting their bodies invalidates the guard against overwriting user edits.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    ".eve/**",
    "tests/eve-results/**",
    // The model catalog is generator-owned; avoid unrelated snapshot churn.
    "lib/ai/models.generated.ts",
    "**/tools/chatjs/{tools,ui,providers,code-executor,workflow-types,tool-availability,document-ui,document-run,installed-features,composer-tools,search-config,code-execution-config,url-retrieval-config,image-generation-config,video-generation-config}.ts",
  ],
});
/* oxlint-enable import/no-default-export */
