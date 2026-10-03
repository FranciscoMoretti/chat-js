/* oxlint-disable eslint/max-statements -- listBranches: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/init-declarations -- listBranches: Assignment occurs only after branch-specific validation; eager initialization would hide definite-assignment guarantees. */
/* oxlint-disable eslint/no-magic-numbers -- listBranches: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- listBranches: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- listBranches: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/**
 * @typedef {{id: string, name: string, parent_id: string, created_at: string, default?: boolean, primary?: boolean, protected?: boolean}} NeonBranch
 * @typedef {{state: string, closed_at: string, head: {ref: string, repo: {full_name: string} | null}}} PullRequest
 * @typedef {{rest: {pulls: {get: (params: Record<string, unknown>) => Promise<{data: PullRequest}>, list: unknown}}, paginate: (method: unknown, params: Record<string, unknown>) => Promise<unknown[]>}} GitHubClient
 */

/**
 * @param {string} base - Neon branch-list endpoint.
 * @param {Record<string, string>} headers - Authentication headers for Neon.
 * @param {(url: string, options: RequestInit) => Promise<Response>} request - Injectable HTTP request implementation.
 * @returns {Promise<NeonBranch[]>} All branch pages after validating pagination.
 */
const listBranches = async (base, headers, request) => {
  /** @type {NeonBranch[]} */
  const branches = [];
  const cursors = new Set();
  /** @type {string | undefined} */
  let cursor;
  do {
    const url = cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base;
    // eslint-disable-next-line no-await-in-loop -- Each Neon pagination request requires the cursor from the preceding response.
    const response = await request(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Neon branch lookup failed (${response.status}).`);
    }
    /** @type {{branches: NeonBranch[], pagination?: {next?: string}}} */
    // oxlint-disable-next-line typescript/no-unsafe-assignment, eslint/no-await-in-loop -- Neon JSON is checked for a branch array and bounded cursor below; destructive candidates are validated before deletion.
    const page = await response.json();
    if (!Array.isArray(page.branches)) {
      throw new TypeError("Expected a Neon branch list.");
    }
    branches.push(...page.branches);
    cursor = page.pagination?.next;
    if (cursor && (typeof cursor !== "string" || cursors.has(cursor))) {
      throw new Error("Invalid or repeated Neon pagination cursor.");
    }
    cursors.add(cursor);
  } while (cursor);
  return branches;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- isDeletablePreview: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- isDeletablePreview: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/**
 * @param {NeonBranch} branch - Candidate preview branch returned by Neon.
 * @param {string} parentId - Parent branch that must never be deleted.
 * @returns {boolean} Whether the candidate is an unprotected child of the expected parent.
 */
const isDeletablePreview = (branch, parentId) =>
  typeof branch.id === "string" &&
  branch.id !== parentId &&
  branch.parent_id === parentId &&
  !branch.default &&
  !branch.primary &&
  !branch.protected;
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- cleanupPreviewDatabase: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/max-lines-per-function -- cleanupPreviewDatabase: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable eslint/no-magic-numbers -- cleanupPreviewDatabase: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- cleanupPreviewDatabase: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- cleanupPreviewDatabase: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
// Maintainer infrastructure only: never copied into generated applications.
/**
 * @returns {Promise<string>} Cleanup outcome after validating current pull-request and branch ownership.
 * @param {{github: GitHubClient, repository: {owner: string, repo: string}, number: number, apiKey?: string, request?: (url: string, options: RequestInit) => Promise<Response>}} options - GitHub workflow context and the injectable Neon request implementation. */
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
  const branches = await listBranches(base, headers, request);
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
  // Refuse branches recreated after this closure, including stale manual retries.
  if (!(Date.parse(branch.created_at) <= Date.parse(pull.closed_at))) {
    return "Skipped preview created after PR closure or with unknown age.";
  }
  // Refresh ownership after Neon lookup, immediately before the destructive call.
  const { data: current } = await github.rest.pulls.get({
    ...repository,
    pull_number: number,
  });
  if (
    current.state !== "closed" ||
    current.closed_at !== pull.closed_at ||
    current.head.ref !== pull.head.ref ||
    current.head.repo?.full_name !== pull.head.repo.full_name
  ) {
    return "Skipped changed pull request.";
  }
  const active = await github.paginate(github.rest.pulls.list, {
    ...repository,
    head: `${repository.owner}:${pull.head.ref}`,
    per_page: 100,
    state: "open",
  });
  if (active.length > 0) {
    return "Skipped branch still used by an open pull request.";
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
