const BASE_PORT = 3000;
const PORTS_PER_SLOT = 10;

export interface DevRuntime {
  origin: string;
  port: number;
  slot: number;
}

export function resolveDevRuntime(rawSlot = "0"): DevRuntime {
  if (!/^\d+$/.test(rawSlot)) {
    throw new Error(
      `Invalid CHATJS_DEV_SLOT "${rawSlot}": expected a non-negative integer`
    );
  }

  const slot = Number(rawSlot);
  const port = BASE_PORT + slot * PORTS_PER_SLOT;

  if (!Number.isSafeInteger(slot) || port > 65_535) {
    throw new Error(
      `Invalid CHATJS_DEV_SLOT "${rawSlot}": computed port exceeds 65535`
    );
  }

  return {
    origin: `http://localhost:${port}`,
    port,
    slot,
  };
}
