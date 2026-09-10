import { createClient } from "redis";
import { redisConnectionOptions } from "./connection";

const STARTUP_DEADLINE_MS = 10_000;

export async function connectRedisClients(
  environment: { REDIS_URL?: string },
  onError: () => void
) {
  const options = redisConnectionOptions(environment);
  if (!options) {
    return null;
  }

  const publisher = createClient(options);
  const subscriber = publisher.duplicate();
  publisher.on("error", onError);
  subscriber.on("error", onError);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([publisher.connect(), subscriber.connect()]),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error("Redis startup timed out")),
          STARTUP_DEADLINE_MS
        );
      }),
    ]);
    return { publisher, subscriber };
  } catch {
    if (publisher.isOpen) {
      publisher.destroy();
    }
    if (subscriber.isOpen) {
      subscriber.destroy();
    }
    onError();
    return null;
  } finally {
    clearTimeout(deadline);
  }
}
