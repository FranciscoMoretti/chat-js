import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import { registerEveStoredFile } from "../lib/db/eve-files";
import { eveStoredFile, user } from "../lib/db/schema";
import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("File ownership acceptance requires local Postgres.");
}
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
await db.insert(user).values(
  [owner, stranger].map((id) => ({
    id,
    email: `${id}@test.invalid`,
    name: "File ownership fixture",
  }))
);
afterAll(async () => {
  await db
    .delete(eveStoredFile)
    .where(inArray(eveStoredFile.ownerId, [owner, stranger]));
  await db.delete(user).where(inArray(user.id, [owner, stranger]));
});

test("server-created file ownership is retryable but cannot be reassigned", async () => {
  const key = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
  await registerEveStoredFile(owner, key);
  await registerEveStoredFile(owner, key);
  await expect(registerEveStoredFile(stranger, key)).rejects.toThrow(
    "cannot be reassigned"
  );
  expect(
    await db
      .select({ ownerId: eveStoredFile.ownerId })
      .from(eveStoredFile)
      .where(eq(eveStoredFile.key, key))
  ).toEqual([{ ownerId: owner }]);
});

test("registration rejects URLs and invalid storage keys", async () => {
  for (const key of [
    "../file",
    "https://example.com/file.png",
    "",
    "a".repeat(25),
  ]) {
    await expect(registerEveStoredFile(owner, key)).rejects.toThrow(
      "Invalid file ownership"
    );
  }
});
