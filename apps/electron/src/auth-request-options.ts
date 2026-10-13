import type { ElectronRequestAuthOptions } from "@better-auth/electron/client";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAuthRequestOptions = (
  value: unknown
): value is ElectronRequestAuthOptions => {
  if (!isRecord(value)) {
    return false;
  }
  const strings = [
    "provider",
    "callbackURL",
    "newUserCallbackURL",
    "errorCallbackURL",
  ];
  const flags = ["disableRedirect", "requestSignUp"];
  return (
    strings.every(
      (key) => value[key] === undefined || typeof value[key] === "string"
    ) &&
    flags.every(
      (key) => value[key] === undefined || typeof value[key] === "boolean"
    ) &&
    (value.scopes === undefined ||
      (Array.isArray(value.scopes) &&
        value.scopes.every((scope: unknown) => typeof scope === "string"))) &&
    (value.additionalData === undefined || isRecord(value.additionalData))
  );
};

const parseAuthRequestOptions = (
  value?: unknown
): ElectronRequestAuthOptions | undefined => {
  if (value === undefined || isAuthRequestOptions(value)) {
    return value;
  }
  throw new Error("Invalid browser sign-in options.");
};

export { parseAuthRequestOptions };
