import { createCatalog } from "../../../../../packages/registry/create-catalog";

export const GET = async (): Promise<Response> => {
  try {
    const options = { next: { revalidate: 3600 } } satisfies RequestInit;
    return Response.json(await createCatalog.eveItem.choices.load(options));
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
