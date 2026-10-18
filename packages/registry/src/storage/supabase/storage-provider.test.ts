import { expect, test } from "bun:test";

import { StorageClient } from "@supabase/storage-js";
import { Files, FilesError } from "files-sdk";

import { createStorageAdapter } from "./storage-provider";

const badRequestStatus = 400;
const missingObject = {
  error: "not_found",
  message: "Object not found",
  statusCode: "404",
};

const filesWithResponse = (respond: () => Promise<Response>): Files => {
  const client = new StorageClient(
    "https://storage.example/storage/v1",
    {},
    Object.assign(respond, { preconnect: fetch.preconnect })
  );
  return new Files({
    adapter: createStorageAdapter({ bucket: "private", client }),
    retries: 0,
  });
};

const filesWithError = (
  body: Readonly<Record<string, string>>,
  status: number
): Files =>
  filesWithResponse(
    async () => await Promise.resolve(Response.json(body, { status }))
  );

const failureOf = async (
  operation: () => Promise<unknown>
): Promise<unknown> => {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the lookup to fail");
};

test("a Supabase missing object returns false from exists", async () => {
  expect(
    await filesWithError(missingObject, badRequestStatus).exists("deleted")
  ).toBe(false);
});

test("missing Supabase reads retain the Files SDK NotFound contract", async () => {
  const files = filesWithError(missingObject, badRequestStatus);
  expect(
    await failureOf(async () => await files.head("deleted"))
  ).toMatchObject({ code: "NotFound" });
  expect(
    await failureOf(async () => await files.download("deleted"))
  ).toMatchObject({ code: "NotFound" });
  expect(await failureOf(async () => await files.url("deleted"))).toMatchObject(
    { code: "NotFound" }
  );
});

test.each([
  { body: { message: "Object not found", statusCode: "403" }, status: 403 },
  { body: { message: "Object not found", statusCode: "500" }, status: 500 },
  { body: { message: "Object not found", statusCode: "400" }, status: 400 },
  { body: missingObject, status: 403 },
  { body: missingObject, status: 500 },
])(
  "an ambiguous or failed lookup is never proof of absence: $status",
  async ({
    body,
    status,
  }: {
    readonly body: Readonly<Record<string, string>>;
    readonly status: number;
  }) => {
    const failure = await failureOf(
      async () => await filesWithError(body, status).exists("uncertain")
    );
    expect(failure).toBeInstanceOf(FilesError);
    expect(failure).not.toMatchObject({ code: "NotFound" });
  }
);

test("an existing object remains present", async () => {
  const files = filesWithResponse(
    async () =>
      await Promise.resolve(
        Response.json({ contentType: "text/plain", name: "present", size: 1 })
      )
  );
  expect(await files.exists("present")).toBe(true);
});

test("a network failure remains an error", async () => {
  const files = filesWithResponse(
    async () => await Promise.reject(new TypeError("Connection failed"))
  );
  expect(
    await failureOf(async () => await files.exists("uncertain"))
  ).toMatchObject({ code: "Provider" });
});
