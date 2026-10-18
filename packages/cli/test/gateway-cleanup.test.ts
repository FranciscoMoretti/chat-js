import { expect, test } from "bun:test";
import { rejects as assertRejects } from "node:assert/strict";

import { cleanupGatewayFixture } from "./gateway-cleanup";

const originalValues = [
  { name: "absent" },
  { name: "empty", value: "" },
  { name: "populated", value: "original-registry" },
];

for (const original of originalValues) {
  for (const rejects of [false, true]) {
    test(`restores ${original.name} URL immediately and awaits ${rejects ? "rejected" : "resolved"} stop`, async () => {
      const environment: Record<string, string | undefined> = {
        CHATJS_REGISTRY_URL: "fixture-registry",
      };
      const stopping = Promise.withResolvers<number>();
      const removalStarted = Promise.withResolvers<number>();
      const removalFinished = Promise.withResolvers<number>();
      const failure = new Error("Stop failed");
      const events: string[] = [];
      const cleanup = cleanupGatewayFixture({
        environment,
        originalRegistryUrl: original.value,
        async removeFiles() {
          events.push("remove");
          removalStarted.resolve(1);
          await removalFinished.promise;
        },
        server: {
          async stop(force) {
            expect(force).toBe(true);
            expect(environment.CHATJS_REGISTRY_URL).toBe("fixture-registry");
            events.push("stop");
            await stopping.promise;
          },
        },
      });
      let completed = false;
      const observeCompletion = async (): Promise<void> => {
        try {
          await cleanup;
        } finally {
          completed = true;
        }
      };
      const completion = observeCompletion();
      const assertion = rejects
        ? assertRejects(completion, { errors: [failure] })
        : completion;
      expect(environment.CHATJS_REGISTRY_URL).toBe(original.value);
      expect(Object.hasOwn(environment, "CHATJS_REGISTRY_URL")).toBe(
        original.value !== undefined
      );
      await Promise.resolve();
      expect(events).toEqual(["stop"]);

      if (rejects) {
        stopping.reject(failure);
      } else {
        stopping.resolve(1);
      }
      await removalStarted.promise;
      expect(events).toEqual(["stop", "remove"]);
      expect(completed).toBe(false);
      removalFinished.resolve(1);
      await assertion;
      expect(completed).toBe(true);
    });
  }

  test(`restores ${original.name} URL when stop throws synchronously`, async () => {
    const environment: Record<string, string | undefined> = {
      CHATJS_REGISTRY_URL: "fixture-registry",
    };
    const stopFailure = new Error("Synchronous stop failure");
    const removalFailure = new Error("Removal failed");
    const cleanup = cleanupGatewayFixture({
      environment,
      originalRegistryUrl: original.value,
      removeFiles() {
        throw removalFailure;
      },
      server: {
        stop() {
          throw stopFailure;
        },
      },
    });
    expect(environment.CHATJS_REGISTRY_URL).toBe(original.value);
    expect(Object.hasOwn(environment, "CHATJS_REGISTRY_URL")).toBe(
      original.value !== undefined
    );
    await assertRejects(cleanup, {
      errors: [stopFailure, removalFailure],
    });
  });
}

test("reports file cleanup rejection after stopping the registry", async () => {
  const environment: Record<string, string | undefined> = {
    CHATJS_REGISTRY_URL: "fixture-registry",
  };
  const failure = new Error("Removal failed");
  const stopped = Promise.withResolvers<number>();
  const cleanup = cleanupGatewayFixture({
    environment,
    originalRegistryUrl: "original-registry",
    async removeFiles() {
      await stopped.promise;
      throw failure;
    },
    server: {
      async stop() {
        stopped.resolve(1);
        await stopped.promise;
      },
    },
  });
  await assertRejects(cleanup, { errors: [failure] });
  expect(environment.CHATJS_REGISTRY_URL).toBe("original-registry");
});
