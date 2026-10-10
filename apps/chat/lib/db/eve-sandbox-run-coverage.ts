// Pinned eve 0.61.0 workflow identities. Do not infer safety from suffixes or
// unknown wrapper names: authored workflow bodies can allocate resources.
const sessionWorkflow = "workflow//eve//workflowEntry";
const coveredWorkflows = new Set([
  "workflow//eve//turnWorkflow",
  "workflow//eve//sessionTimeoutWorkflow",
  "workflow//eve@0.52.2//executeSleepTool",
  "workflow//eve@0.61.0//executeSleepTool",
]);

const NO_PARENT_EDGES = 0;
const PARENT_EDGE = 1;

const recordEveSandboxParentEdge = (
  parent: string,
  runId: string,
  children: Readonly<Pick<Map<string, string[]>, "get" | "set">>
): void => {
  const dependents = children.get(parent) ?? [];
  dependents.push(runId);
  children.set(parent, dependents);
};

/** Index declared parent edges for the reviewed native workflows.
 * @param {readonly { readonly id: string; readonly workflowName: string; readonly parentId: string | null; readonly eveParentId: string | null }[]} runs Read-only native workflow identities and ancestry declarations; unknown workflows contribute no edges.
 * @returns {{ remaining: Map<string, number>; children: Map<string, string[]> }} Distinct declared parent counts and ordered child lists for reachability traversal. Repeated run identities retain the existing count overwrite and edge-list behavior.
 */
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

      if (parents.length > NO_PARENT_EDGES) {
        remaining.set(run.id, parents.length);
        for (const parent of parents) {
          recordEveSandboxParentEdge(parent, run.id, children);
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
  const visitChild = (child: string): void => {
    const count = (remaining.get(child) ?? NO_PARENT_EDGES) - PARENT_EDGE;
    remaining.set(child, count);
    if (count === NO_PARENT_EDGES) {
      covered.add(child);
      pending.push(child);
    }
  };
  for (const parent of pending) {
    for (const child of children.get(parent) ?? []) {
      visitChild(child);
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
