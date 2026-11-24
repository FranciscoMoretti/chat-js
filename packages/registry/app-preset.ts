import { installationSelectionSchema } from "./installation";
import type { InstallationSelection } from "./installation";

import { appPresetPrefix, serializeAppPreset } from "./app-preset-wire";

const MAX_PRESET_LENGTH = 500_000;

/** Complete UTF-8 authoring choices, shared by the browser and CLI. */
export const encodeAppPreset = (input: InstallationSelection): string =>
  serializeAppPreset(installationSelectionSchema.parse(input));

export const decodeAppPreset = (code: string): InstallationSelection => {
  if (!code.startsWith(appPresetPrefix) || code.length > MAX_PRESET_LENGTH) {
    throw new Error(
      "Invalid Agent configuration. Export a new configuration from Create."
    );
  }
  const encoded = code.slice(appPresetPrefix.length);
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) {
    throw new Error("Invalid Agent configuration encoding.");
  }
  const bytes = Uint8Array.from(
    atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
    (character) => character.codePointAt(0) ?? 0
  );
  return installationSelectionSchema.parse(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  );
};

export const readInstallationInput = (input: string): InstallationSelection =>
  input.trim().startsWith("{")
    ? installationSelectionSchema.parse(JSON.parse(input))
    : decodeAppPreset(input.trim());
