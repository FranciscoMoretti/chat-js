import { expect, it, spyOn } from "bun:test";

import { Client } from "basic-ftp";

import { createStorageAdapter } from "./storage-provider";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve connectStorage's awaited sequencing and rejected-Promise behavior. */
const connectStorage = async (
  secure: "implicit" | undefined
): Promise<Client> => {
  const { raw } = createStorageAdapter({ host: "storage.example", secure });
  if (raw instanceof Client) {
    throw new TypeError("Expected a connection factory");
  }
  const client = await raw.connect();
  return client;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable node/no-process-env -- This environment fixture clears FTP_SECURE and returns ownership of restoring its exact previous presence/value. */
const isolateSecureEnvironment = (): (() => void) => {
  const previous = process.env.FTP_SECURE;
  delete process.env.FTP_SECURE;
  return () => {
    if (typeof previous === "string") {
      process.env.FTP_SECURE = previous;
    } else {
      delete process.env.FTP_SECURE;
    }
  };
};

/* oxlint-enable node/no-process-env */

const variants: { readonly label: string; readonly secure?: "implicit" }[] = [
  { label: "default TLS" },
  { label: "implicit TLS", secure: "implicit" },
];

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(variants)'s awaited sequencing and rejected-Promise behavior. */
it.each(variants)("uses $label for FTP connections", async ({ secure }) => {
  const access = spyOn(Client.prototype, "access").mockResolvedValue({
    code: 220,
    message: "ready",
  });
  const restoreEnvironment = isolateSecureEnvironment();
  try {
    const client = await connectStorage(secure);
    expect(access).toHaveBeenLastCalledWith(
      expect.objectContaining({ secure: secure ?? true })
    );
    client.close();
  } finally {
    access.mockRestore();
    restoreEnvironment();
  }
});
/* oxlint-enable oxc/no-async-await */
