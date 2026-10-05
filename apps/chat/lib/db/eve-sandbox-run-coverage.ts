// Pinned eve 0.61.0 workflow identities. Do not infer safety from suffixes or
// unknown wrapper names: authored workflow bodies can allocate resources.
const sessionWorkflow = "workflow//eve//workflowEntry";
const coveredWorkflows = new Set([
  "workflow//eve//turnWorkflow",
  "workflow//eve//sessionTimeoutWorkflow",
  "workflow//eve@0.52.2//executeSleepTool",
  "workflow//eve@0.61.0//executeSleepTool",
]);

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (classifyEveSandboxRuns); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, max-statements, no-continue, no-magic-numbers --
 * max-lines-per-function (#510): classifyEveSandboxRuns keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): classifyEveSandboxRuns keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): classifyEveSandboxRuns skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): classifyEveSandboxRuns uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/** Classify workflow ancestry without authorizing resource deletion.
 * Birth receipts, writer fences and local evidence are still required.
 * @param {readonly { readonly id: string; readonly workflowName: string; readonly parentId: string | null; readonly eveParentId: string | null }[]} runs Workflow identities and declared ancestry to classify; entries are not mutated.
 * @returns {{ sessionIds: string[]; unresolvedRunIds: string[] }} Sorted session candidates and runs not proven covered. Coverage requires a known workflow and every declared ancestry path reaching a session; cycles and unknown workflows remain unresolved.
 */
export const classifyEveSandboxRuns = (
  runs: readonly {
    readonly id: string;
    readonly workflowName: string;
    readonly parentId: string | null;
    readonly eveParentId: string | null;
  }[]
): { sessionIds: string[]; unresolvedRunIds: string[] } => {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, max-statements, no-continue, no-magic-numbers */
