import { parseSkillsCatalog } from "../../../../../packages/registry/eve-catalog";

export const GET = async (request: Request): Promise<Response> => {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return Response.json(
      { error: "Enter between 2 and 120 characters." },
      { status: 400 }
    );
  }
  const url = new URL("https://www.skills.sh/r/registry");
  url.searchParams.set("agent", "eve");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error("Skills registry unavailable");
    }
    return Response.json(parseSkillsCatalog(await response.json()));
  } catch {
    return Response.json(
      { error: "Could not search skills.sh. Try again." },
      { status: 503 }
    );
  }
};
