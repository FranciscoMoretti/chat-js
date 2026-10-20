import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/** Read a small guest command without buffering an unbounded HTTP request. */
export const readGuestBody = async (
  request: ReadonlyNativeSurface<Request>
): Promise<unknown> => {
  const reader = request.clone().body?.getReader();
  if (!reader) {
    return null;
  }
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read and bound each sequential stream chunk before requesting the next.
      const part = await reader.read();
      if (part.done) {
        break;
      }
      bytes += part.value.byteLength;
      if (bytes > 24_000) {
        void reader.cancel();
        return null;
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
};
