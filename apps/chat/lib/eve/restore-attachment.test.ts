import { afterEach, expect, it, vi } from "vitest";

import { restoreEveAttachment } from "./restore-attachment";

const origin = "http://localhost:3790";
const path = "/api/files/content?key=abcdefghijklmnopqrstuvwx.png";
const part = {
  type: "file",
  mediaType: "image/png",
  filename: "image.png",
  url: path,
} satisfies Parameters<typeof restoreEveAttachment>[0];
afterEach(() => vi.unstubAllGlobals());

it("restores exact bytes and filename from relative and absolute owned file URLs", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const fetcher = vi.fn(() =>
    Promise.resolve(
      new Response(bytes, { headers: { "content-type": "image/png" } })
    )
  );
  vi.stubGlobal("fetch", fetcher);
  for (const url of [path, origin + path]) {
    const file = await restoreEveAttachment({ ...part, url }, origin, 10);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
    expect(file.name).toBe("image.png");
    expect(file.type).toBe("image/png");
  }
  expect(fetcher).toHaveBeenCalledWith(
    path,
    expect.objectContaining({ credentials: "same-origin", redirect: "error" })
  );
});

it("still restores inline native bytes", async () => {
  const file = await restoreEveAttachment(
    { ...part, url: "data:image/png;base64,AQID" },
    origin,
    10
  );
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(
    new Uint8Array([1, 2, 3])
  );
});

it("rejects external, malformed, and unsupported references without fetching", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const url of [
    `https://other.example${path}`,
    `//other.example${path}`,
    `${origin}/api/private`,
    `${path}&other=1`,
    "data:text/html;base64,AQID",
    `${path}#fragment`,
  ]) {
    await expect(
      restoreEveAttachment({ ...part, url }, origin, 10)
    ).rejects.toThrow();
  }
  expect(fetcher).not.toHaveBeenCalled();
});

it("rejects unavailable, mismatched, empty, and oversized files instead of dropping them", async () => {
  for (const response of [
    new Response(null, { status: 404 }),
    new Response("x", { headers: { "content-type": "text/plain" } }),
    new Response("", { headers: { "content-type": "image/png" } }),
    new Response("too large", { headers: { "content-type": "image/png" } }),
  ]) {
    vi.stubGlobal("fetch", () => Promise.resolve(response));
    await expect(restoreEveAttachment(part, origin, 3)).rejects.toThrow();
  }
});
