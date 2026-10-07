// Pinned eve 0.61.0 workflow identities. Do not infer safety from suffixes or
// unknown wrapper names: authored workflow bodies can allocate resources.
const sessionWorkflow = "workflow//eve//workflowEntry";
const coveredWorkflows = new Set([
  "workflow//eve//turnWorkflow",
  "workflow//eve//sessionTimeoutWorkflow",
  "workflow//eve@0.52.2//executeSleepTool",
  "workflow//eve@0.61.0//executeSleepTool",
]);

/** Index declared parent edges for the reviewed native workflows.
 * @param {readonly { readonly id: string; readonly workflowName: string; readonly parentId: string | null; readonly eveParentId: string | null }[]} runs Read-only native workflow identities and ancestry declarations; unknown workflows contribute no edges.
 * @returns {{ remaining: Map<string, number>; children: Map<string, string[]> }} Distinct declared parent counts and ordered child lists for reachability traversal. Repeated run identities retain the existing count overwrite and edge-list behavior.
 */
// oxlint-disable-next-line max-statements -- Indexing preserves run order, deduplicates each run's declared parent edges, and retains duplicate-run count overwrite plus child-list insertion behavior in this 12-statement phase.
const indexEveSandboxAncestry = (
  runs: readonly {
    readonly id: string;
    readonly workflowName: string;
    readonly parentId: string | null;
    readonly eveParentId: string | null;
  }[]
): { remaining: Map<string, number>; children: Map<string, string[]> } => {
  const remaining = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const run of runs) {
    if (coveredWorkflows.has(run.workflowName)) {
      const parents = [...new Set([run.parentId, run.eveParentId])].filter(
        (parent): parent is string => parent !== null
      );
      // oxlint-disable-next-line no-magic-numbers -- A workflow with no declared parent edges cannot be reached from a session candidate.
      if (parents.length > 0) {
        remaining.set(run.id, parents.length);
        for (const parent of parents) {
          const dependents = children.get(parent) ?? [];
          dependents.push(run.id);
          children.set(parent, dependents);
        }
      }
    }
  }
  return { children, remaining };
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (classifyEveSandboxRuns); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/** Classify workflow ancestry without authorizing resource deletion.
 * Birth receipts, writer fences and local evidence are still required.
 * @param {readonly { readonly id: string; readonly workflowName: string; readonly parentId: string | null; readonly eveParentId: string | null }[]} runs Workflow identities and declared ancestry to classify; entries are not mutated.
 * @returns {{ sessionIds: string[]; unresolvedRunIds: string[] }} Sorted session candidates and runs not proven covered. Coverage requires a known workflow and every declared ancestry path reaching a session; cycles and unknown workflows remain unresolved.
 */
// oxlint-disable-next-line max-statements -- This 12-statement classification seeds sorted session candidates, traverses all indexed ancestry edges iteratively, and returns sorted unresolved runs without recursive stack growth.
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
  const { remaining, children } = indexEveSandboxAncestry(runs);
  // Every declared ancestry path must reach a session candidate. Processing
  // edges once handles deep graphs and converging paths; cycles remain unresolved.
  const pending = [...sessionIds];
  for (const parent of pending) {
    for (const child of children.get(parent) ?? []) {
      // oxlint-disable-next-line no-magic-numbers -- Each traversed parent edge decrements the unresolved count by one; preserve the zero fallback for a missing count.
      const count = (remaining.get(child) ?? 0) - 1;
      remaining.set(child, count);
      // oxlint-disable-next-line no-magic-numbers -- A child is covered only after every declared parent edge has been traversed.
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
