# Submission notes

Published as [eve #3524: Support fresh conversations initialized from settled structured history](https://github.com/vercel/eve/issues/3524). The issue uses first-person language and describes chat apps rather than ChatJS. No implementation PR has been submitted; wait for maintainer invitation.

Local draft: [minimal history contract proposal](eve-minimal-history-contract-proposal.md).

## Guidelines checked

Fetched upstream main on 2026-09-18, commit `241e5004cb1ac1e2bcd716a154bbc64f5a61cc53`:

- [CONTRIBUTING.md](https://github.com/vercel/eve/blob/241e5004cb1ac1e2bcd716a154bbc64f5a61cc53/CONTRIBUTING.md): external contributors should propose an issue, search existing work, and wait for maintainer invitation before submitting implementation. The local fork experiment does not establish upstream approval.
- [Feature request template](https://github.com/vercel/eve/blob/241e5004cb1ac1e2bcd716a154bbc64f5a61cc53/.github/ISSUE_TEMPLATE/feature_request.yml): problem, proposed solution, optional implementation prompt, alternatives.
- [PR template](https://github.com/vercel/eve/blob/241e5004cb1ac1e2bcd716a154bbc64f5a61cc53/.github/pull_request_template.md): Summary, Validation, Checklist. A later invited PR must describe the problem first, list exact checks and limitations, and include maintainer approval, relevant tests/docs, changeset, and DCO sign-off. Contribution guidelines additionally require verified commit signatures.

The authenticated GitHub CLI search failed because its configured proxy socket was unavailable. Public web search found the overlapping issues above and was used to inspect their bodies; this was not an exhaustive review of all PRs or discussion activity. Recheck the live threads before posting.

## Before a future PR

Reproduce any completion-capture bug on current upstream before proposing it as a separate fix. Port only the agreed contract to a branch from current main, rather than submitting the existing compiled fork overlay. Include the public-API research document and relevant coverage, and resolve applicable native validation failures. Do not mark the PR checklist complete based on the old fork's prototype results.
