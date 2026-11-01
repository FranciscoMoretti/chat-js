import type { FtpAdapter, FtpAdapterOptions } from "files-sdk/ftp";
import { ftp } from "files-sdk/ftp";

const getSecureDefault = (): true | "implicit" => {
  if (process.env.FTP_SECURE === "implicit") {
    return "implicit";
  }
  return true;
};

export const createStorageAdapter = (
  options: Readonly<FtpAdapterOptions> = {}
): FtpAdapter => {
  const secure = options.secure ?? getSecureDefault();
  return ftp({ ...options, secure });
};
