import type { ChatStatus } from "ai";
import type { ThreadRun } from "./types";

interface RunSnapshotReader {
  readonly error: Readonly<Error> | undefined;
  readonly spec: Readonly<{ id: string }>;
  readonly status: ChatStatus;
}

const toRunSnapshot = (run: RunSnapshotReader): ThreadRun => ({
  error: run.error,
  id: run.spec.id,
  status: run.status,
});

const readRunSnapshots = (
  source: Readonly<{ snapshots: () => ThreadRun[] }>
): {
  activeRuns: ThreadRun[];
  runs: ThreadRun[];
  status: "submitted" | "streaming" | "ready";
} => {
  const runs = source.snapshots();
  const activeRuns = runs.filter(
    (run: { readonly status: ChatStatus }): boolean =>
      run.status === "submitted" || run.status === "streaming"
  );
  let status: ChatStatus = "ready";
  if (
    activeRuns.some(
      (run: { readonly status: ChatStatus }): boolean =>
        run.status === "streaming"
    )
  ) {
    status = "streaming";
  } else if (
    activeRuns.some(
      (run: { readonly status: ChatStatus }): boolean =>
        run.status === "submitted"
    )
  ) {
    status = "submitted";
  }
  return { activeRuns, runs, status };
};

/* oxlint-disable import/no-named-export -- This internal snapshot projection and its finite reader use named bindings; the enforced no-default-export convention rejects a default export. */
export { readRunSnapshots, toRunSnapshot };
export type { RunSnapshotReader };
/* oxlint-enable import/no-named-export */
