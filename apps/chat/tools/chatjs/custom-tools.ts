import { defineToolSet } from "@/lib/eve/tool-types";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing installation composition bindings (customTools); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const customTools = defineToolSet({});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
