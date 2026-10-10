import type { FtpAdapter, FtpAdapterOptions } from "files-sdk/ftp";
import { ftp } from "files-sdk/ftp";

const getSecureDefault = (): true | "implicit" => {
  // oxlint-disable-next-line node/no-process-env -- Resolve omitted secure options from the actual FTP_SECURE server setting; the caller's explicit secure value skips this resolver.
  if (process.env.FTP_SECURE === "implicit") {
    return "implicit";
  }
  return true;
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createStorageAdapter); the enabled import/no-default-export convention rejects the default-export alternative. */
export const createStorageAdapter = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the caller-owned preconnected basic-ftp Client instance; recursive readonly mapping drops its private nominal members and fails the actual files-sdk FtpAdapterOptions receiver, while Readonly<FtpAdapterOptions> preserves the native instance.
  options: Readonly<FtpAdapterOptions> = {}
): FtpAdapter => {
  const secure = options.secure ?? getSecureDefault();
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return ftp({ ...options, secure });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
