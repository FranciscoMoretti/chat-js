import { afterEach, expect, it, vi } from "vitest";

import { connectRedisClients } from "./client";

const clients = vi.hoisted(() => {
  const subscriber = {
    connect: vi.fn(),
    destroy: vi.fn(),
    isOpen: true,
    on: vi.fn(),
  };
  const publisher = {
    connect: vi.fn(),
    destroy: vi.fn(),
    duplicate: () => subscriber,
    isOpen: true,
    on: vi.fn(),
  };
  return { publisher, subscriber };
});
vi.mock("redis", () => ({ createClient: () => clients.publisher }));
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

it("cleans up both clients when one initial connection rejects", async () => {
  clients.publisher.connect.mockImplementation(() => Promise.resolve());
  clients.subscriber.connect.mockRejectedValue(new Error("Unavailable"));
  const onError = vi.fn();
  expect(
    await connectRedisClients({ REDIS_URL: "redis://localhost" }, onError)
  ).toBeNull();
  expect(clients.publisher.destroy).toHaveBeenCalledOnce();
  expect(clients.subscriber.destroy).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledOnce();
});

it("bounds initial connection retries so optional Redis cannot hang route loading", async () => {
  vi.useFakeTimers();
  clients.publisher.connect.mockImplementation(() => Promise.resolve());
  clients.subscriber.connect.mockImplementation(
    () => Promise.withResolvers().promise
  );
  const pending = connectRedisClients(
    { REDIS_URL: "redis://localhost" },
    vi.fn()
  );
  await vi.advanceTimersByTimeAsync(10_000);
  expect(await pending).toBeNull();
  expect(clients.publisher.destroy).toHaveBeenCalledOnce();
  expect(clients.subscriber.destroy).toHaveBeenCalledOnce();
});

it("returns the connected pair and leaves it open for normal reconnect behavior", async () => {
  clients.publisher.connect.mockImplementation(() => Promise.resolve());
  clients.subscriber.connect.mockImplementation(() => Promise.resolve());
  expect(
    await connectRedisClients({ REDIS_URL: "redis://localhost" }, vi.fn())
  ).toEqual(clients);
  expect(clients.publisher.destroy).not.toHaveBeenCalled();
});
