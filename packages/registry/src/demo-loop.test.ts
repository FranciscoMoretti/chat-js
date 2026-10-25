import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMirrorLoop } from "../scripts/registry-mirror/loop";
import { withMirrorLock } from "../scripts/registry-mirror/lock";
import { changedInputs } from "../scripts/registry-mirror/inputs";

test("startup and running edits drain serially, failures recover, and shutdown drains an active writer", async () => {
  const shutdown = new AbortController();
  let content = "initial";
  let notify = (): void => {
    throw new Error(`Watcher must register before ${content}`);
  };
  const entered = Array.from({ length: 5 }, () =>
    Promise.withResolvers<boolean>()
  );
  const gates = Array.from({ length: 5 }, () =>
    Promise.withResolvers<boolean>()
  );
  const events: string[] = [];
  let active = 0;
  let maximum = 0;
  let passes = 0;
  const ready = Promise.withResolvers<boolean>();
  const failed = Promise.withResolvers<boolean>();
  const loop = runMirrorLoop({
    signal: shutdown.signal,
    debounceMs: 1,
    pollMs: 60_000,
    snapshot: async () => await Promise.resolve({ source: content }),
    subscribe: (changed) => {
      notify = changed;
      events.push("watch");
      return () => {
        events.push("stop");
      };
    },
    synchronize: async () => {
      const pass = passes;
      passes += 1;
      active += 1;
      maximum = Math.max(maximum, active);
      entered[pass].resolve(true);
      await gates[pass].promise;
      active -= 1;
      if (pass === 2) {
        throw new Error("Invalid source");
      }
    },
    succeeded: (settled) => {
      if (settled && !events.includes("ready")) {
        events.push("ready");
        ready.resolve(true);
      }
    },
    failed: () => {
      events.push(events.includes("ready") ? "stale" : "initial-failure");
      failed.resolve(true);
    },
  });
  try {
    await entered[0].promise;
    content = "startup edit";
    // No notification: reconciliation must catch delayed/coalesced startup events.
    gates[0].resolve(true);
    await entered[1].promise;
    expect(events).toEqual(["watch"]);
    gates[1].resolve(true);
    await ready.promise;
    content = "broken";
    notify();
    await entered[2].promise;
    gates[2].resolve(true);
    await failed.promise;
    content = "corrected";
    notify();
    await entered[3].promise;
    content = "latest";
    notify();
    notify();
    gates[3].resolve(true);
    await entered[4].promise;
    shutdown.abort();
    expect(active).toBe(1);
    gates[4].resolve(true);
    await loop;
    expect(maximum).toBe(1);
    expect(events).toEqual(["watch", "ready", "stale", "stop"]);
  } finally {
    shutdown.abort();
    for (const gate of gates) {
      gate.resolve(true);
    }
    await loop;
  }
});

test("initial failure stays stopped until a successful retry", async () => {
  const shutdown = new AbortController();
  let first = true;
  let failures = 0;
  await runMirrorLoop({
    signal: shutdown.signal,
    debounceMs: 1,
    pollMs: 5,
    snapshot: async () =>
      await Promise.resolve({
        source: "unchanged input (e.g. writer lock released)",
      }),
    subscribe: () => () => {
      /* fixture has no native watcher */
    },
    synchronize: async () => {
      if (first) {
        first = false;
        await Promise.reject(new Error("Writer busy"));
      }
      await Promise.resolve();
    },
    succeeded: (settled) => {
      expect(settled).toBe(true);
      expect(failures).toBe(1);
      shutdown.abort();
    },
    failed: () => {
      failures += 1;
    },
  });
});

test("snapshot differences include additions and removals", () => {
  expect(
    changedInputs({ old: "a", same: "b" }, { new: "a", same: "b" })
  ).toEqual(["old", "new"]);
});
test("writer leases reject overlap, release on failure, and isolate checkouts", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "demo-lock-test-"));
  const lock = path.join(directory, "writer.lock");
  try {
    await withMirrorLock(lock, async () => {
      expect(
        withMirrorLock(lock, async () => await Promise.resolve(true))
      ).rejects.toThrow("Another registry mirror");
      expect(
        await withMirrorLock(
          path.join(directory, "other.lock"),
          async () => await Promise.resolve(true)
        )
      ).toBe(true);
    });
    expect(
      withMirrorLock(
        lock,
        async () => await Promise.reject(new Error("failed"))
      )
    ).rejects.toThrow("failed");
    expect(
      await withMirrorLock(lock, async () => await Promise.resolve(true))
    ).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a startup edit reverted before the next pass still reports settled success", async () => {
  const shutdown = new AbortController();
  let snapshots = 0;
  let generations = 0;
  const successes: boolean[] = [];
  await runMirrorLoop({
    signal: shutdown.signal,
    debounceMs: 1,
    snapshot: async () => {
      snapshots += 1;
      return await Promise.resolve({
        source: snapshots === 2 ? "temporary edit" : "initial",
      });
    },
    subscribe: () => () => {
      /* No filesystem notifications in this fixture. */
    },
    synchronize: async () => {
      generations += 1;
      await Promise.resolve();
    },
    succeeded: (settled) => {
      successes.push(settled);
      if (settled) {
        shutdown.abort();
      }
    },
    failed: (error) => {
      throw error;
    },
  });
  expect(successes).toEqual([false, true]);
  expect(generations).toBe(1);
});

test("an edit reverted during generation is reconciled before readiness", async () => {
  const shutdown = new AbortController();
  let notify = (): void => {
    shutdown.abort();
  };
  let content = "A";
  let output = "";
  let passes = 0;
  const successes: boolean[] = [];
  await runMirrorLoop({
    signal: shutdown.signal,
    debounceMs: 1,
    pollMs: 60_000,
    snapshot: async () => await Promise.resolve({ source: content }),
    subscribe: (changed) => {
      notify = changed;
      return () => {};
    },
    synchronize: async () => {
      passes += 1;
      if (passes === 1) {
        content = "B";
        notify();
      }
      output = content;
      if (passes === 1) {
        content = "A";
        notify();
      }
      await Promise.resolve();
    },
    succeeded: (settled) => {
      successes.push(settled);
      if (settled) {
        shutdown.abort();
      }
    },
    failed: (error) => {
      throw error;
    },
  });
  expect(output).toBe("A");
  expect(passes).toBe(2);
  expect(successes).toEqual([false, true]);
});

test("unchanged failures back off while corrected inputs retry immediately", async () => {
  const shutdown = new AbortController();
  let now = 0;
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  let content = "broken";
  let notify = (): void => {
    shutdown.abort();
  };
  const attempts: number[] = [];
  try {
    await runMirrorLoop({
      signal: shutdown.signal,
      debounceMs: 1,
      pollMs: 5,
      snapshot: async () => {
        now += 1;
        return await Promise.resolve({ source: content });
      },
      subscribe: (changed) => {
        notify = changed;
        return () => {};
      },
      synchronize: async () => {
        attempts.push(now);
        if (content === "broken") {
          throw new Error("Invalid source");
        }
        await Promise.resolve();
      },
      failed: () => {
        if (attempts.length === 3) {
          content = "fixed";
          notify();
        }
      },
      succeeded: () => {
        shutdown.abort();
      },
    });
    expect(attempts).toHaveLength(4);
    expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(5);
    expect(attempts[2] - attempts[1]).toBeGreaterThanOrEqual(10);
    expect(attempts[3] - attempts[2]).toBeLessThan(5);
  } finally {
    clock.mockRestore();
    shutdown.abort();
  }
});
