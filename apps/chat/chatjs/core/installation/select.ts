/** Resolve an exclusive integration without silently choosing between providers. */
export const selectIntegration = <Value>(
  name: string,
  installed: readonly Value[]
): Value | undefined => {
  if (installed.length > 1) {
    throw new Error(`Only one ${name} integration may be selected.`);
  }
  return installed[0];
};
