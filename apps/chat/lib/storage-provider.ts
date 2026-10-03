import { issueSignedToken, presignUrl } from "@vercel/blob";
import { vercelBlob } from "files-sdk/vercel-blob";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Add private download signing until the Files SDK adapter exposes it. */
export const createStorageAdapter = (
  options: Parameters<typeof vercelBlob>[0] = {}
) => {
  const adapter = vercelBlob({ ...options, access: "private" });
  return {
    ...adapter,
    signedUrl: { maxExpiresIn: 300, supported: true },
    url: async (pathname: string): Promise<string> => {
      const validUntil = Date.now() + 300_000;
      const token = await issueSignedToken({
        oidcToken: options.oidcToken,
        operations: ["get"],
        pathname,
        storeId: options.storeId,
        token: options.token,
        validUntil,
      });
      const { presignedUrl } = await presignUrl(token, {
        access: "private",
        operation: "get",
        pathname,
        validUntil,
      });
      return presignedUrl;
    },
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable import/prefer-default-export */
