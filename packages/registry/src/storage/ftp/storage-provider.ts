import { ftp } from "files-sdk/ftp";

export const createStorageAdapter = (
  options: Parameters<typeof ftp>[0] = {}
) => {
  const secure =
    options.secure ??
    (process.env.FTP_SECURE === "implicit" ? "implicit" : true);
  return ftp({ ...options, secure });
};
