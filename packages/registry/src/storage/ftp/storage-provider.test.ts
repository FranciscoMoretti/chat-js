import { expect, it, spyOn } from "bun:test";

import { Client } from "basic-ftp";

import { createStorageAdapter } from "./storage-provider";

/* oxlint-disable eslint/max-statements -- Keep setup, side effects, and assertions for uses TLS for default FTP connections and preserves implicit TLS selection together so the transaction and cleanup remain visible in one test. */
/* oxlint-disable node/no-process-env -- Temporarily clear FTP_SECURE and restore its exact previous presence/value after both connection variants. */
/* oxlint-disable eslint/no-undefined -- Exercise an omitted secure option and restore an environment variable that was originally absent. */
it("uses TLS for default FTP connections and preserves implicit TLS selection", async () => {
  const access = spyOn(Client.prototype, "access").mockResolvedValue({
    code: 220,
    message: "ready",
  });
  const previousSecure = process.env.FTP_SECURE;
  delete process.env.FTP_SECURE;
  try {
    for (const secure of [undefined, "implicit"] as const) {
      const adapter = createStorageAdapter({ host: "storage.example", secure });
      const { raw } = adapter;
      if (raw instanceof Client) {
        throw new TypeError("Expected a connection factory");
      }
      // Each connection mutates the same environment-backed adapter configuration.
      // eslint-disable-next-line no-await-in-loop -- Each connect mutates the same environment-backed adapter configuration; complete and close one connection before the next variant.
      const client = await raw.connect();
      expect(access).toHaveBeenLastCalledWith(
        expect.objectContaining({ secure: secure ?? true })
      );
      client.close();
    }
  } finally {
    access.mockRestore();
    if (previousSecure === undefined) {
      delete process.env.FTP_SECURE;
    } else {
      process.env.FTP_SECURE = previousSecure;
    }
  }
});
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/max-statements */
