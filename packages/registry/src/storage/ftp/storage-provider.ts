import type { FtpAdapter, FtpAdapterOptions } from "files-sdk/ftp";
import { ftp } from "files-sdk/ftp";

export const createStorageAdapter = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the caller-owned preconnected basic-ftp Client instance; recursive readonly mapping drops its private nominal members and fails the actual files-sdk FtpAdapterOptions receiver, while Readonly<FtpAdapterOptions> preserves the native instance.
  options: Readonly<FtpAdapterOptions> = {}
): FtpAdapter => {
  const secure =
    options.secure ??
    // oxlint-disable-next-line node/no-process-env -- Resolve the omitted secure option from the actual FTP_SECURE server configuration; passing explicit secure bypasses this fallback.
    (process.env.FTP_SECURE === "implicit" ? "implicit" : true);
  return ftp({ ...options, secure });
};
