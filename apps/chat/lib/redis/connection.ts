import { z } from "zod";

const CONNECT_TIMEOUT_MS = 10_000;

export const redisEnvOptions = {
  REDIS_URL: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z
        .string()
        .refine((value) => {
          if (!URL.canParse(value)) {
            return false;
          }
          const url = new URL(value);
          return ["redis:", "rediss:"].includes(url.protocol) && !!url.hostname;
        }, "Use a redis:// or rediss:// connection URL, not an HTTP REST endpoint")
        .optional()
    )
    .describe(
      "Redis TCP/TLS connection URL for resumable streams and rate limits"
    ),
};

export const redisConnectionOptions = (environment: { REDIS_URL?: string }) =>
  environment.REDIS_URL
    ? {
        socket: { connectTimeout: CONNECT_TIMEOUT_MS },
        url: environment.REDIS_URL,
      }
    : null;
