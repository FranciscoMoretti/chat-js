import { expect, it, spyOn } from "bun:test";
import { Client } from "basic-ftp";
import { createStorageAdapter } from "./storage-provider";

it("uses TLS for default FTP connections and preserves implicit TLS selection", async () => {
  const access = spyOn(Client.prototype, "access").mockResolvedValue({ code: 220, message: "ready" });
  const previousSecure = process.env.FTP_SECURE;
  delete process.env.FTP_SECURE;
  try {
    for (const secure of [undefined, "implicit"] as const) {
      const adapter = createStorageAdapter({ host: "storage.example", secure });
      const raw = adapter.raw;
      if (raw instanceof Client) throw new Error("Expected a connection factory");
      const client = await raw.connect();
      expect(access).toHaveBeenLastCalledWith({ host: "storage.example", port: 21, secure: secure ?? true });
      client.close();
    }
  } finally {
    access.mockRestore();
    if (previousSecure === undefined) delete process.env.FTP_SECURE;
    else process.env.FTP_SECURE = previousSecure;
  }
});
