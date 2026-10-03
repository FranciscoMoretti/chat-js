/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, node/no-process-env, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): resolveWorkflowWorld's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveWorkflowWorld's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * node/no-process-env (#537): resolveWorkflowWorld reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/explicit-function-return-type (#560): Keep resolveWorkflowWorld's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep resolveWorkflowWorld's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): resolveWorkflowWorld accepts environment: { VERCEL?: string; VERCEL_ENV?: string; NODE_ENV?: string; } = process.e; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Shared by agent compilation, runtime validation and setup; no user backend switch. */
export const resolveWorkflowWorld = (
  environment: {
    VERCEL?: string;
    VERCEL_ENV?: string;
    NODE_ENV?: string;
  } = process.env
) => {
  // `vercel dev` / pulled development environments still use local PostgreSQL.
  // NODE_ENV alone never selects managed Workflow (self-hosted builds are production too).
  const deployed =
    environment.VERCEL === "1" &&
    environment.VERCEL_ENV !== "development" &&
    environment.NODE_ENV !== "development";
  return deployed ? "vercel" : "@workflow/world-postgres";
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, node/no-process-env, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
