import type { InstallationSelection } from "./installation";

export const appPresetPrefix = "agent1_";

/** Wire encoding for a known-valid selection. Decode validates at the receiving boundary. */
export const serializeAppPreset = (
  selection: Readonly<InstallationSelection>
): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(selection));
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(
    ""
  );
  return (
    appPresetPrefix +
    btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
  );
};
