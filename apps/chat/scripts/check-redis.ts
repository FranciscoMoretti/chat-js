import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import { createClient } from "redis";
import { z } from "zod";

import { config } from "../lib/config";
import {
  redisConnectionOptions,
  redisEnvOptions,
} from "../lib/redis/connection";

const CHECK_DEADLINE_MS = 15_000;
const PROBE_TTL_SECONDS = 60;
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

async function checkRedis() {
  const parsed = z.object(redisEnvOptions).safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Invalid Redis configuration");
  }
  const options = redisConnectionOptions(parsed.data);
  if (!options) {
    process.stdout.write(
      "Redis is not configured. Set REDIS_URL to check a provider.\n"
    );
    return;
  }
  const publisher = createClient({
    ...options,
    socket: { ...options.socket, reconnectStrategy: false },
  });
  const subscriber = publisher.duplicate();
  // Failures are reported below without exposing provider errors or credentials.
  publisher.on("error", () => undefined);
  subscriber.on("error", () => undefined);
  const key = `${config.appPrefix}:connection-check:${randomUUID()}`;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        await Promise.all([publisher.connect(), subscriber.connect()]);
        await publisher.set(key, "0", { EX: PROBE_TTL_SECONDS });
        if (
          (await publisher.get(key)) !== "0" ||
          (await publisher.incr(key)) !== 1
        ) {
          throw new Error("Key/value or counter check failed");
        }
        if (
          !(
            (await publisher.expire(key, PROBE_TTL_SECONDS)) &&
            (await publisher.exists(key)) === 1
          )
        ) {
          throw new Error("Expiry or key lookup check failed");
        }
        let receive: (() => void) | undefined;
        const received = new Promise<void>((resolve) => {
          receive = resolve;
        });
        await subscriber.subscribe(key, (message) => {
          if (message === "probe") {
            receive?.();
          }
        });
        await publisher.publish(key, "probe");
        await received;
        await subscriber.unsubscribe(key);
        await publisher.del(key);
      })(),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error("Redis check timed out")),
          CHECK_DEADLINE_MS
        );
      }),
    ]);
    process.stdout.write(
      "Redis connection, key/value, counters, expiry, key lookup, and pub/sub OK.\n"
    );
  } finally {
    clearTimeout(deadline);
    if (publisher.isOpen) {
      publisher.destroy();
    }
    if (subscriber.isOpen) {
      subscriber.destroy();
    }
  }
}

checkRedis().catch(() => {
  process.stderr.write(
    "Redis check failed. Check REDIS_URL, TLS, credentials, network access, and command/channel permissions. See https://www.chatjs.dev/docs/reference/redis\n"
  );
  process.exitCode = 1;
});
