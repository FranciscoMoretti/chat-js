import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

// oxlint-disable-next-line import/no-named-export, import/prefer-default-export -- The app requires named imports and rejects default exports for this internal relay formatter.
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
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- Preserve the original single-read truthiness guard, including custom native Headers methods; Boolean(value) in the condition conflicts with no-extra-boolean-cast and a stored flag loses string narrowing.
    if (value) {
      headers.set(key, value);
    }
  }
  return new Response(result.body, { headers, status: result.status });
};
