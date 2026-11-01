/** Refuse deployment unless Supabase confirms the selected bucket is private. */
export const verifyPrivateBucket = async (
  bucket: string,
  environment: Readonly<Record<string, string | undefined>> = process.env
): Promise<void> => {
  const base = environment.SUPABASE_URL;
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (base === undefined || base === "" || key === undefined || key === "") {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to verify storage."
    );
  }
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Supabase storage verification requires an HTTPS origin.");
  }
  url.pathname = `/storage/v1/bucket/${encodeURIComponent(bucket)}`;
  url.search = "";
  url.hash = "";
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      "Could not verify the Supabase bucket. Deployment refused."
    );
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    value.id !== bucket ||
    !("public" in value) ||
    value.public !== false
  ) {
    throw new Error("The selected Supabase bucket must exist and be private.");
  }
};
