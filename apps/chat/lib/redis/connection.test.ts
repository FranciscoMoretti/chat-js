import { expect, it } from "vitest";
import { z } from "zod";

import { redisConnectionOptions, redisEnvOptions } from "./connection";

const schema = z.object(redisEnvOptions);

it("allows Redis to be omitted and preserves TCP/TLS provider URLs", () => {
  expect(redisConnectionOptions(schema.parse({ REDIS_URL: "" }))).toBeNull();
  for (const url of [
    "redis://localhost:6379/0",
    "rediss://default:password@provider.example:6380",
  ]) {
    expect(redisConnectionOptions(schema.parse({ REDIS_URL: url }))?.url).toBe(
      url
    );
  }
});

it("rejects REST URLs and malformed Redis endpoints", () => {
  for (const url of ["https://provider.example", "redis:///", "not-a-url"]) {
    expect(schema.safeParse({ REDIS_URL: url }).success).toBe(false);
  }
});
