import { issueSignedToken, presignUrl } from "@vercel/blob";
import { vercelBlob } from "files-sdk/vercel-blob";

/** Add private download signing until the Files SDK adapter exposes it. */
export const createStorageAdapter = (
  options: Parameters<typeof vercelBlob>[0] = {}
) => {
  const adapter = vercelBlob({ ...options, access: "private" });
  return {
    ...adapter,
    signedUrl: { maxExpiresIn: 300, supported: true },
    url: async (pathname: string) => {
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
