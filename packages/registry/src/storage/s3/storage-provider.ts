// oxlint-disable-next-line import/prefer-default-export, import/no-named-export -- The registry installs this named createStorageAdapter contract; the enabled import/no-default-export rule rejects a default export.
export { s3 as createStorageAdapter } from "files-sdk/s3";
