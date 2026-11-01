interface ProcessRow {
  readonly parent: number;
  readonly pid: number;
  readonly started: string;
}

export const parseProcessRows = (snapshot: string): ProcessRow[] =>
  snapshot
    .trim()
    .split("\n")
    .map((line) => {
      const [pid, parent, ...started] = line.trim().split(/\s+/u);
      return {
        parent: Number(parent),
        pid: Number(pid),
        started: started.join(" "),
      };
    });

export const findDescendants = (
  rootPid: number,
  rows: readonly ProcessRow[]
): Set<number> => {
  const found = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { pid, parent } of rows) {
      if (
        Boolean(pid) &&
        Boolean(parent) &&
        found.has(parent) &&
        !found.has(pid)
      ) {
        found.add(pid);
        changed = true;
      }
    }
  }
  return found;
};
