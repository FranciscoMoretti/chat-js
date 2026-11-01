import { expect, it, spyOn } from "bun:test";

import { Client } from "basic-ftp";

import { createStorageAdapter } from "./storage-provider";

const connectStorage = async (
  secure: boolean | "implicit" | undefined
): Promise<Client> => {
  const { raw } = createStorageAdapter({ host: "storage.example", secure });
  if (raw instanceof Client) {
    throw new TypeError("Expected a connection factory");
  }
  const client = await raw.connect();
  return client;
};
const isolateSecureEnvironment = (value?: string): (() => void) => {
  const previous = process.env.FTP_SECURE;
  if (typeof value === "string") {
    process.env.FTP_SECURE = value;
  } else {
    delete process.env.FTP_SECURE;
  }
  return () => {
    if (typeof previous === "string") {
      process.env.FTP_SECURE = previous;
    } else {
      delete process.env.FTP_SECURE;
    }
  };
};

const variants: {
  readonly environment?: string;
  readonly expectedSecure: boolean | "implicit";
  readonly label: string;
  readonly secure?: boolean | "implicit";
}[] = [
  { expectedSecure: true, label: "default TLS" },
  {
    expectedSecure: "implicit",
    label: "explicit implicit TLS",
    secure: "implicit",
  },
  {
    environment: "implicit",
    expectedSecure: "implicit",
    label: "environment implicit TLS",
  },
  {
    environment: "implicit",
    expectedSecure: true,
    label: "explicit TLS over environment implicit TLS",
    secure: true,
  },
  {
    environment: "implicit",
    expectedSecure: false,
    label: "explicit plain FTP over environment implicit TLS",
    secure: false,
  },
];

it.each(variants)(
  "uses $label for FTP connections",
  async ({ environment, expectedSecure, secure }) => {
    const access = spyOn(Client.prototype, "access").mockResolvedValue({
      code: 220,
      message: "ready",
    });
    const restoreEnvironment = isolateSecureEnvironment(environment);
    try {
      const client = await connectStorage(secure);
      expect(access).toHaveBeenLastCalledWith(
        expect.objectContaining({ secure: expectedSecure })
      );
      client.close();
    } finally {
      access.mockRestore();
      restoreEnvironment();
    }
  }
);

it("preserves the caller-owned FTP client", () => {
  const client = new Client();
  try {
    expect(createStorageAdapter({ client }).raw).toBe(client);
  } finally {
    client.close();
  }
});
