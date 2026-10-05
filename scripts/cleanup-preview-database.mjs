/**
 * @typedef {Readonly<{id: string, name: string, parent_id?: string | null, created_at: string, default?: boolean, primary?: boolean, protected?: boolean}>} NeonBranch
 * @typedef {Readonly<{state: string, closed_at: string, head: Readonly<{ref: string, repo: Readonly<{full_name: string}> | null}>}>} PullRequest
 * @typedef {Readonly<{rest: Readonly<{pulls: Readonly<{get: (params: Readonly<Record<string, unknown>>) => Promise<Readonly<{data: PullRequest}>>, list: unknown}>}>, paginate: (method: unknown, params: Readonly<Record<string, unknown>>) => Promise<readonly unknown[]>}>} GitHubClient
 * @typedef {Readonly<{branches: readonly NeonBranch[], pagination?: Readonly<{next?: unknown}> | null}>} NeonBranchPage
 * @typedef {Readonly<{kind: "skip", result: string}> | Readonly<{kind: "ready", pull: PullRequest}>} PullRequestGate
 * @typedef {Readonly<{kind: "absent"}> | Readonly<{kind: "recreated"}> | Readonly<{kind: "ready", branch: NeonBranch, base: string, headers: Readonly<Record<string, string>>}>} PreviewCandidate
 * @typedef {Readonly<{kind: "skip", result: string}> | Readonly<{kind: "ready", pull: PullRequest, candidate: Extract<PreviewCandidate, {kind: "ready"}>}>} DeletionPreparation
 * @typedef {Readonly<{kind: "skip", result: string}> | Readonly<{kind: "deleted"}>} DeletionOutcome
 * @typedef {Readonly<{headers: Readonly<Record<string, string>>, signal: Readonly<AbortSignal>, method?: string}>} NeonRequestOptions
 * @typedef {Readonly<{ok: boolean, status: number, json: () => Promise<unknown>}>} NeonApiResponse
 * @typedef {(url: string, options: NeonRequestOptions) => Promise<NeonApiResponse>} NeonRequest
 */

const NEON_REQUEST_TIMEOUT_MS = 30_000;
const OPEN_PULL_REQUEST_PAGE_SIZE = 100;
const HTTP_NOT_FOUND_STATUS = 404;
const NO_BRANCH_MATCHES = 0;
const ONE_BRANCH_MATCH = 1;
const EMPTY_CURSOR = "";
const EMPTY_STRING_LENGTH = 0;
const ZERO_CURSOR_VALUE = 0;
const NEON_BRANCHES_URL =
  "https://console.neon.tech/api/v2/projects/flat-pine-61604628/branches";
const PROTECTED_PARENT_BRANCH_ID = "br-quiet-pine-za1aryyz";

/**
 * @param {unknown} value - Untrusted JSON value.
 * @returns {value is Readonly<Record<string, unknown>>} Whether the value is a non-array object.
 */
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * @param {unknown} value - Untrusted Neon branch value.
 * @returns {value is NeonBranch} Whether the value contains the branch fields used by cleanup.
 */
const isNeonBranch = (value) =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  (!("parent_id" in value) ||
    value.parent_id === null ||
    typeof value.parent_id === "string") &&
  typeof value.created_at === "string" &&
  (!("default" in value) || typeof value.default === "boolean") &&
  (!("primary" in value) || typeof value.primary === "boolean") &&
  (!("protected" in value) || typeof value.protected === "boolean");

/**
 * @param {unknown} value - Cursor value received from Neon.
 * @returns {boolean} Whether the value has the same stop-loop behavior as a falsey JavaScript cursor.
 */
const isFalsyCursor = (value) =>
  value === null ||
  value === false ||
  value === ZERO_CURSOR_VALUE ||
  value === EMPTY_CURSOR;

/**
 * @param {Readonly<Record<string, unknown>>} value - Untrusted Neon response body.
 * @returns {boolean} Whether a truthy pagination cursor is a string.
 */
const hasValidPagination = (value) =>
  !("pagination" in value) ||
  value.pagination === null ||
  (isRecord(value.pagination) &&
    (!("next" in value.pagination) ||
      isFalsyCursor(value.pagination.next) ||
      typeof value.pagination.next === "string"));

/**
 * @param {unknown} value - Untrusted Neon response body.
 * @returns {value is NeonBranchPage} Whether the response has validated branch and cursor fields.
 */
const isNeonBranchPage = (value) =>
  isRecord(value) &&
  Array.isArray(value.branches) &&
  value.branches.every((branch) => isNeonBranch(branch)) &&
  hasValidPagination(value);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchBranchPage's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {Readonly<{base: string, cursor: string, headers: Readonly<Record<string, string>>, request: NeonRequest}>} options - Inputs for one Neon page request.
 * @returns {Promise<NeonBranchPage>} A validated Neon branch page.
 */
const fetchBranchPage = async ({ base, cursor, headers, request }) => {
  const url =
    cursor === EMPTY_CURSOR
      ? base
      : `${base}?cursor=${encodeURIComponent(cursor)}`;
  const response = await request(url, {
    headers,
    signal: AbortSignal.timeout(NEON_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Neon branch lookup failed (${response.status}).`);
  }
  /** @type {unknown} */
  const pageValue = await response.json();
  if (!isNeonBranchPage(pageValue)) {
    throw new TypeError("Expected a Neon branch list.");
  }
  return pageValue;
};
/* oxlint-enable oxc/no-async-await */
/**
 * @param {Readonly<NeonBranchPage>} page - Validated page whose cursor advances the scan.
 * @param {Readonly<Set<string>>} seenCursors - Previously followed opaque cursors.
 * @returns {string} The next cursor, or the empty end-of-list sentinel.
 */
const readNextCursor = (page, seenCursors) => {
  const hasCursor = isRecord(page.pagination) && "next" in page.pagination;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading next from page.pagination; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const rawCursor = page.pagination?.next;
  if (hasCursor && !isFalsyCursor(rawCursor) && typeof rawCursor !== "string") {
    throw new Error("Invalid or repeated Neon pagination cursor.");
  }
  const nextCursor = typeof rawCursor === "string" ? rawCursor : EMPTY_CURSOR;
  if (nextCursor !== EMPTY_CURSOR && seenCursors.has(nextCursor)) {
    throw new Error("Invalid or repeated Neon pagination cursor.");
  }
  return nextCursor;
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listBranches's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {Readonly<{base: string, headers: Readonly<Record<string, string>>, request: NeonRequest}>} options - Inputs for the paginated Neon request.
 * @returns {Promise<readonly NeonBranch[]>} All branch pages after validating pagination.
 */
const listBranches = async ({ base, headers, request }) => {
  /** @type {NeonBranch[]} */
  const branches = [];
  /** @type {Set<string>} */
  const cursors = new Set();
  let cursor = EMPTY_CURSOR;
  /**
   * @param {string} pageCursor - Cursor for this sequential page request.
   * @returns {Promise<Readonly<{branches: readonly NeonBranch[], cursor: string}>>} Branches and the next cursor.
   */
  const fetchNextPage = async (pageCursor) => {
    /** @type {NeonBranchPage} */
    const pageValue = await fetchBranchPage({
      base,
      cursor: pageCursor,
      headers,
      request,
    });
    const nextCursor = readNextCursor(pageValue, cursors);
    if (nextCursor !== EMPTY_CURSOR) {
      cursors.add(nextCursor);
    }
    return { branches: pageValue.branches, cursor: nextCursor };
  };
  do {
    // eslint-disable-next-line no-await-in-loop -- Each Neon pagination request requires the cursor from the preceding response.
    const page = await fetchNextPage(cursor);
    const { branches: nextBranches, cursor: nextCursor } = page;
    branches.push(...nextBranches);
    cursor = nextCursor;
  } while (cursor !== EMPTY_CURSOR);
  return branches;
};
/* oxlint-enable oxc/no-async-await */
/**
 * @param {NeonBranch} branch - Candidate preview branch returned by Neon.
 * @param {string} parentId - Parent branch that must never be deleted.
 * @returns {boolean} Whether the candidate is an unprotected child of the expected parent.
 */
const isDeletablePreview = (branch, parentId) =>
  typeof branch.id === "string" &&
  branch.id !== parentId &&
  branch.parent_id === parentId &&
  branch.default !== true &&
  branch.primary !== true &&
  branch.protected !== true;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve hasOpenPullRequest's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {GitHubClient} github - GitHub API client.
 * @param {Readonly<{owner: string, repo: string}>} repository - Repository identity.
 * @param {string} headRef - Pull-request head branch name.
 * @returns {Promise<boolean>} Whether another open pull request uses this branch.
 */
const hasOpenPullRequest = async (github, repository, headRef) => {
  const open = await github.paginate(github.rest.pulls.list, {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing repository own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...repository,
    head: `${repository.owner}:${headRef}`,
    per_page: OPEN_PULL_REQUEST_PAGE_SIZE,
    state: "open",
  });
  return open.length > NO_BRANCH_MATCHES;
};
/* oxlint-enable oxc/no-async-await */
/**
 * @param {readonly NeonBranch[]} branches - All validated Neon branches.
 * @param {string} name - Expected preview branch name.
 * @param {string} parentId - Parent branch that must never be deleted.
 * @returns {{kind: "absent"} | {kind: "found", branch: NeonBranch}} The unique deletable preview branch, if any.
 */
const selectPreviewBranch = (branches, name, parentId) => {
  const matches = branches.filter((branch) => branch.name === name);
  if (matches.length === NO_BRANCH_MATCHES) {
    return { kind: "absent" };
  }
  const [branch] = matches;
  if (
    matches.length !== ONE_BRANCH_MATCH ||
    !isDeletablePreview(branch, parentId)
  ) {
    throw new Error(
      "Refusing to delete an ambiguous, protected, or non-preview branch."
    );
  }
  return { branch, kind: "found" };
};

/**
 * @param {PullRequest} current - Current pull-request data.
 * @param {PullRequest} original - Pull-request data checked before Neon lookup.
 * @param {Readonly<{owner: string, repo: string}>} repository - Repository identity.
 * @returns {boolean} Whether ownership and closure data are unchanged.
 */
const hasUnchangedPullRequest = (current, original, repository) =>
  current.state === "closed" &&
  current.closed_at === original.closed_at &&
  current.head.ref === original.head.ref &&
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading full_name from current.head.repo; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. Keep the existing nullish guard when reading full_name from original.head.repo; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  current.head.repo?.full_name === original.head.repo?.full_name &&
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading full_name from current.head.repo; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  current.head.repo?.full_name === `${repository.owner}/${repository.repo}`;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkPullRequestGate's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {GitHubClient} github - GitHub API client.
 * @param {Readonly<{owner: string, repo: string}>} repository - Repository identity.
 * @param {number} number - Pull-request number.
 * @returns {Promise<PullRequestGate>} Whether cleanup may inspect Neon state.
 */
const checkPullRequestGate = async (github, repository, number) => {
  const { data: pull } = await github.rest.pulls.get({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing repository own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...repository,
    pull_number: number,
  });
  if (
    pull.state !== "closed" ||
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading full_name from pull.head.repo; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    pull.head.repo?.full_name !== `${repository.owner}/${repository.repo}`
  ) {
    return { kind: "skip", result: "Skipped open or fork pull request." };
  }
  if (await hasOpenPullRequest(github, repository, pull.head.ref)) {
    return {
      kind: "skip",
      result: "Skipped branch still used by an open pull request.",
    };
  }
  return { kind: "ready", pull };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolvePreviewCandidate's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {Readonly<{pull: PullRequest, apiKey: string | undefined, request: NeonRequest}>} options - Validated closed pull request and Neon request configuration.
 * @returns {Promise<PreviewCandidate>} The candidate branch, if safe to remove.
 */
const resolvePreviewCandidate = async ({ pull, apiKey, request }) => {
  if (typeof apiKey !== "string" || apiKey.length === EMPTY_STRING_LENGTH) {
    throw new Error("NEON_PREVIEW_API_KEY is required.");
  }
  const headers = { Authorization: `Bearer ${apiKey}` };
  const selection = selectPreviewBranch(
    await listBranches({ base: NEON_BRANCHES_URL, headers, request }),
    `preview/${pull.head.ref}`,
    PROTECTED_PARENT_BRANCH_ID
  );
  if (selection.kind === "absent") {
    return { kind: "absent" };
  }
  const { branch } = selection;
  // Refuse branches recreated after this closure, including stale manual retries.
  if (!(Date.parse(branch.created_at) <= Date.parse(pull.closed_at))) {
    return { kind: "recreated" };
  }
  return { base: NEON_BRANCHES_URL, branch, headers, kind: "ready" };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve preparePreviewDeletion's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {Readonly<{github: GitHubClient, repository: Readonly<{owner: string, repo: string}>, number: number, apiKey: string | undefined, request: NeonRequest}>} options - GitHub ownership and Neon request state needed to identify a candidate.
 * @returns {Promise<DeletionPreparation>} The initial safety result and exact candidate branch.
 */
const preparePreviewDeletion = async ({
  github,
  repository,
  number,
  apiKey,
  request,
}) => {
  const gate = await checkPullRequestGate(github, repository, number);
  if (gate.kind === "skip") {
    return gate;
  }
  const { pull } = gate;
  const candidate = await resolvePreviewCandidate({ apiKey, pull, request });
  if (candidate.kind === "absent") {
    return { kind: "skip", result: "Preview database already absent." };
  }
  if (candidate.kind === "recreated") {
    return {
      kind: "skip",
      result: "Skipped preview created after PR closure or with unknown age.",
    };
  }
  return { candidate, kind: "ready", pull };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deletePreviewBranch's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {Readonly<{request: NeonRequest, base: string, headers: Readonly<Record<string, string>>, branchId: string}>} options - Inputs for deleting one selected Neon branch.
 * @returns {Promise<void>} Resolves after successful or already-completed deletion.
 */
const deletePreviewBranch = async ({ request, base, headers, branchId }) => {
  const response = await request(`${base}/${encodeURIComponent(branchId)}`, {
    headers,
    method: "DELETE",
    signal: AbortSignal.timeout(NEON_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok && response.status !== HTTP_NOT_FOUND_STATUS) {
    throw new Error(`Neon branch deletion failed (${response.status}).`);
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deletePreviewIfStillSafe's awaited sequencing and rejected-Promise behavior. */
/**
 * @param {Readonly<{github: GitHubClient, repository: Readonly<{owner: string, repo: string}>, number: number, pull: PullRequest, candidate: Extract<PreviewCandidate, {kind: "ready"}>, request: NeonRequest}>} options - Revalidated deletion candidate and API clients.
 * @returns {Promise<DeletionOutcome>} Whether deletion was skipped or completed.
 */
const deletePreviewIfStillSafe = async ({
  github,
  repository,
  number,
  pull,
  candidate,
  request,
}) => {
  // Refresh ownership after Neon lookup, immediately before the destructive call.
  const { data: current } = await github.rest.pulls.get({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing repository own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...repository,
    pull_number: number,
  });
  if (!hasUnchangedPullRequest(current, pull, repository)) {
    return { kind: "skip", result: "Skipped changed pull request." };
  }
  if (await hasOpenPullRequest(github, repository, pull.head.ref)) {
    return {
      kind: "skip",
      result: "Skipped branch still used by an open pull request.",
    };
  }
  await deletePreviewBranch({
    base: candidate.base,
    branchId: candidate.branch.id,
    headers: candidate.headers,
    request,
  });
  return { kind: "deleted" };
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (cleanupPreviewDatabase); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve cleanupPreviewDatabase's awaited sequencing and rejected-Promise behavior. */
// Maintainer infrastructure only: never copied into generated applications.
/**
 * @returns {Promise<string>} Cleanup outcome after validating current pull-request and branch ownership.
 * @param {Readonly<{github: GitHubClient, repository: Readonly<{owner: string, repo: string}>, number: number, apiKey?: string, request?: NeonRequest}>} options - GitHub workflow context and the injectable Neon request implementation. */
export const cleanupPreviewDatabase = async ({
  github,
  repository,
  number,
  apiKey,
  request = fetch,
}) => {
  const preparation = await preparePreviewDeletion({
    apiKey,
    github,
    number,
    repository,
    request,
  });
  if (preparation.kind === "skip") {
    return preparation.result;
  }
  const outcome = await deletePreviewIfStillSafe({
    candidate: preparation.candidate,
    github,
    number,
    pull: preparation.pull,
    repository,
    request,
  });
  if (outcome.kind === "deleted") {
    return `Deleted preview database for PR #${number}.`;
  }
  return outcome.result;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
