import { defineInstructions } from "eve/instructions";

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 */
export default defineInstructions({
  content:
    "You are a helpful assistant. This is a temporary text conversation. You have no tools, files, saved user history, or ability to perform external actions.",
});
/* oxlint-enable import/no-default-export */
