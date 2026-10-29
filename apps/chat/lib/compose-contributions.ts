export interface ContributionPlacement {
  readonly order?: readonly string[];
  readonly hidden?: readonly string[];
}

/** App-owned entries with the same ID replace installed defaults. Unknown IDs
 * in placement preferences are harmless when their plugin is not installed. */
export const composeContributions = <Entry extends { readonly id: string }>(
  installed: readonly Entry[],
  custom: readonly Entry[],
  placement: ContributionPlacement = {}
): Entry[] => {
  const entries = new Map(installed.map((entry) => [entry.id, entry]));
  for (const entry of custom) {
    entries.set(entry.id, entry);
  }
  for (const id of placement.hidden ?? []) {
    entries.delete(id);
  }
  const result: Entry[] = [];
  for (const id of placement.order ?? []) {
    const entry = entries.get(id);
    if (entry) {
      result.push(entry);
      entries.delete(id);
    }
  }
  return [...result, ...entries.values()];
};
