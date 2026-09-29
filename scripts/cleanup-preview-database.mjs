const isDeletablePreview = (branch, parentId) =>
  typeof branch.id === "string" &&
  branch.id !== parentId &&
  branch.parent_id === parentId &&
  !branch.default &&
  !branch.primary &&
  !branch.protected;

// Maintainer infrastructure only: never copied into generated applications.
export const cleanupPreviewDatabase = async ({
  github,
  repository,
  number,
  apiKey,
  request = fetch,
}) => {
  const { data: pull } = await github.rest.pulls.get({
    ...repository,
    pull_number: number,
  });
  if (
    pull.state !== "closed" ||
    pull.head.repo?.full_name !== `${repository.owner}/${repository.repo}`
  ) {
    return "Skipped open or fork pull request.";
  }
  const open = await github.paginate(github.rest.pulls.list, {
    ...repository,
    head: `${repository.owner}:${pull.head.ref}`,
    per_page: 100,
    state: "open",
  });
  if (open.length > 0) {
    return "Skipped branch still used by an open pull request.";
  }
  if (!apiKey) {
    throw new Error("NEON_PREVIEW_API_KEY is required.");
  }
  // Fixed project and empty parent prevent configuration mistakes from targeting production.
  const base =
    "https://console.neon.tech/api/v2/projects/flat-pine-61604628/branches";
  const parentId = "br-quiet-pine-za1aryyz";
  const headers = { Authorization: `Bearer ${apiKey}` };
  const response = await request(base, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Neon branch lookup failed (${response.status}).`);
  }
  const { branches, pagination } = await response.json();
  if (!Array.isArray(branches) || pagination?.cursor) {
    throw new Error("Expected a complete Neon branch list.");
  }
  const matches = branches.filter(
    (branch) => branch.name === `preview/${pull.head.ref}`
  );
  if (matches.length === 0) {
    return "Preview database already absent.";
  }
  const [branch] = matches;
  if (matches.length !== 1 || !isDeletablePreview(branch, parentId)) {
    throw new Error(
      "Refusing to delete an ambiguous, protected, or non-preview branch."
    );
  }
  const deleted = await request(`${base}/${encodeURIComponent(branch.id)}`, {
    headers,
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });
  if (!deleted.ok && deleted.status !== 404) {
    throw new Error(`Neon branch deletion failed (${deleted.status}).`);
  }
  return `Deleted preview database for PR #${number}.`;
};
