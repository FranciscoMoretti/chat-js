// Pinned eve 0.61.0 workflow identities. Do not infer safety from suffixes or
// unknown wrapper names: authored workflow bodies can allocate resources.
const sessionWorkflow = "workflow//eve//workflowEntry";
const coveredWorkflows = new Set([
  "workflow//eve//turnWorkflow",
  "workflow//eve//sessionTimeoutWorkflow",
  "workflow//eve@0.52.2//executeSleepTool",
  "workflow//eve@0.61.0//executeSleepTool",
]);

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): classifyEveSandboxRuns's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): classifyEveSandboxRuns's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): classifyEveSandboxRuns keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): classifyEveSandboxRuns keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): classifyEveSandboxRuns skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): classifyEveSandboxRuns uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep classifyEveSandboxRuns's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep classifyEveSandboxRuns's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): classifyEveSandboxRuns accepts runs: { id: string; workflowName: string; parentId: string | null; eveParentId: stri; run; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Classification only; birth receipts, writer fences and local evidence are still required. */
export const classifyEveSandboxRuns = (
  runs: {
    id: string;
    workflowName: string;
    parentId: string | null;
    eveParentId: string | null;
  }[]
) => {
  const sessionIds = runs
    .filter((run) => run.workflowName === sessionWorkflow)
    .map((run) => run.id)
    .toSorted();
  const covered = new Set(sessionIds);
  const remaining = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const run of runs) {
    if (!coveredWorkflows.has(run.workflowName)) {
      continue;
    }
    const parents = [...new Set([run.parentId, run.eveParentId])].filter(
      (parent): parent is string => parent !== null
    );
    if (parents.length === 0) {
      continue;
    }
    remaining.set(run.id, parents.length);
    for (const parent of parents) {
      const dependents = children.get(parent) ?? [];
      dependents.push(run.id);
      children.set(parent, dependents);
    }
  }
  // Every declared ancestry path must reach a session candidate. Processing
  // edges once handles deep graphs and converging paths; cycles remain unresolved.
  const pending = [...sessionIds];
  for (const parent of pending) {
    for (const child of children.get(parent) ?? []) {
      const count = (remaining.get(child) ?? 0) - 1;
      remaining.set(child, count);
      if (count === 0) {
        covered.add(child);
        pending.push(child);
      }
    }
  }
  return {
    sessionIds,
    unresolvedRunIds: runs
      .filter((run) => !covered.has(run.id))
      .map((run) => run.id)
      .toSorted(),
  };
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
