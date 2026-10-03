/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export { digitaloceanSpaces as createStorageAdapter } from "files-sdk/digitalocean-spaces";
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
