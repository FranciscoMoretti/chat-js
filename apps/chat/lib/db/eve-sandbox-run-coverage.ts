// Pinned eve 0.61.0 workflow identities. Do not infer safety from suffixes or
// unknown wrapper names: authored workflow bodies can allocate resources.
const sessionWorkflow = "workflow//eve//workflowEntry";
const coveredWorkflows = new Set([
  "workflow//eve//turnWorkflow",
  "workflow//eve//sessionTimeoutWorkflow",
  "workflow//eve@0.52.2//executeSleepTool",
  "workflow//eve@0.61.0//executeSleepTool",
]);

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
    if (!parents.length) {
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
