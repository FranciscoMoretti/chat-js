/** Preferences change picker visibility, never the catalog or server eligibility. */
export const applyModelPreferences = (
  defaults: ReadonlySet<string>,
  preferences: readonly {
    readonly modelId: string;
    readonly enabled: boolean;
  }[]
): ReadonlySet<string> => {
  const enabled = new Set(defaults);
  for (const preference of preferences) {
    if (preference.enabled) {
      enabled.add(preference.modelId);
    } else {
      enabled.delete(preference.modelId);
    }
  }
  return enabled;
};
