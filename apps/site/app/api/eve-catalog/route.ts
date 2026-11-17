import {
  eveRegistryUrl,
  parseEveCatalog,
} from "../../../../../packages/registry/eve-catalog";

export const GET = async (): Promise<Response> => {
  try {
    const response = await fetch(eveRegistryUrl, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error("EVE registry unavailable");
    }
    return Response.json(parseEveCatalog(await response.json()));
  } catch {
    return Response.json(
      {
        error:
          "EVE’s catalog could not be loaded. Your selections are preserved. Try again.",
      },
      { status: 503 }
    );
  }
};
