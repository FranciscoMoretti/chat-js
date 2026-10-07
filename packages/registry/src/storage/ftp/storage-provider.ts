import type { FtpAdapter, FtpAdapterOptions } from "files-sdk/ftp";
import { ftp } from "files-sdk/ftp";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createStorageAdapter); the enabled import/no-default-export convention rejects the default-export alternative. */
export const createStorageAdapter = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the caller-owned preconnected basic-ftp Client instance; recursive readonly mapping drops its private nominal members and fails the actual files-sdk FtpAdapterOptions receiver, while Readonly<FtpAdapterOptions> preserves the native instance.
  options: Readonly<FtpAdapterOptions> = {}
): FtpAdapter => {
  const secure =
    options.secure ??
    // oxlint-disable-next-line node/no-process-env, no-ternary -- Resolve the omitted secure option from the actual FTP_SECURE server configuration; passing explicit secure bypasses this fallback.; no-ternary: Keep ?? operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    (process.env.FTP_SECURE === "implicit" ? "implicit" : true);
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return ftp({ ...options, secure });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
