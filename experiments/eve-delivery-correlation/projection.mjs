// Experimental ChatJS-owned storage/projection contract; not wired into production.
export function reconcile(submissions, scope, event) {
  if (
    event.type !== "message.received" ||
    !Array.isArray(event.data.correlationIds)
  )
    return { submissions, annotation: undefined };
  const scoped = submissions.filter(
    (row) => row.ownerId === scope.ownerId && row.sessionId === scope.sessionId
  );
  const ids = event.data.correlationIds;
  const matched = scoped.filter((row) => ids.includes(row.operationId));
  const last = scoped.find((row) => row.operationId === ids.at(-1));
  return {
    submissions: submissions.map((row) =>
      matched.includes(row) ? { ...row, status: "received" } : row
    ),
    // Missing last contributor never borrows an earlier contributor's selection.
    annotation:
      last === undefined ? undefined : { selectedTool: last.selectedTool },
  };
}
