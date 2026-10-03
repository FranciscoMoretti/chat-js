import { expect, it, spyOn } from "bun:test";

import { Client } from "basic-ftp";

import { createStorageAdapter } from "./storage-provider";

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
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
      // eslint-disable-next-line no-await-in-loop
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
