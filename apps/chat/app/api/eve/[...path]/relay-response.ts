import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

export const relayResponse = (
  result: ReadonlyNativeSurface<Response>
): Response => {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const key of [
    "content-type",
    "x-eve-session-id",
    "x-eve-stream-format",
    "x-eve-stream-version",
    "x-eve-stream-tail-index",
  ]) {
    const value = result.headers.get(key);
    if (value !== null && value !== "") {
      headers.set(key, value);
    }
  }
  return new Response(result.body, { headers, status: result.status });
};
