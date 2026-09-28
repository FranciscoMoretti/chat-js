# ChatJS maintainer previews

This is infrastructure for the ChatJS repository's demo project. It is not part of the generated ChatJS application and is not required by downstream users.

## Vercel project setup

Connect the dedicated, empty `chatjs-previews` Neon resource to **Preview only**. Use no custom environment variable prefix. Enable **Require Active Resource Before Deploy** and **Create Database Branch For Deployment → Preview**. The integration must supply `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_PROJECT_ID` to both builds and deployed functions. Keep production data out of this resource. Remove conflicting Preview-scoped variables or resource connections; preserve Production and Development configuration.

Set these maintainer-only Preview variables:

- `CHATJS_PREVIEW_NEON_PROJECT_ID`: the dedicated Neon project ID.
- `CHATJS_PREVIEW_PARENT_HOST`: the direct hostname of its empty parent branch.

Generate independent Preview `AUTH_SECRET` and `EVE_GATEWAY_SECRET` values. Leave `EVE_INTERNAL_ORIGIN` and `WORKFLOW_POSTGRES_URL` unset so previews use the deployment origin and managed Vercel Workflow.

Set the demo project's Build Command to:

```sh
bun ../../scripts/vercel-preview-build.ts
```

The project root is `apps/chat`. Its `vercel.json` intentionally leaves the build command to project settings or the framework default. The scaffold CLI writes the normal build command for generated applications.

## Build and runtime behavior

The root build script validates the expected Neon project, matching pooled and direct connections, and that the selected host differs from the parent. It fails closed on missing or invalid Preview configuration. It normalizes hostname case and trailing dots, validates the parent as a hostname, and requires matching credentials and effective ports. It uses a direct PostgreSQL session advisory lock to serialize migrations of the same branch, invokes the application's existing `db:migrate`, and then runs its normal build. Production and non-preview builds run the normal build without this setup.

Lock acquisition waits for the preceding migration; Vercel’s overall build deadline bounds that wait. Failures identify the phase (connection, lock acquisition, migration, cleanup, or build) and a safe error code when available. Provider messages and connection URLs are omitted.

Runtime uses the integration-provided `DATABASE_URL` directly. The script does not rewrite application code, generate credential files, or rely on build-time environment changes reaching deployed functions. `DATABASE_MIGRATION_URL` is selected only for the build subprocesses. All Neon-specific logic lives in root `scripts/`, which the app template does not copy.

Run the maintainer validation tests with:

```sh
bun test scripts/vercel-preview-environment.test.ts ./scripts/vercel-preview-build.test.ts
```

After changing this setup, verify a real preview conversation, reload its history, and continue it after redeploying the same branch. Confirm the parent remains empty and the deployment reuses its preview branch.

## Cleanup

Neon removes an integrated preview branch after its last associated Vercel deployment is deleted. The demo project's deployment retention is 30 days. Closing a PR alone does not guarantee immediate branch deletion; retention exceptions can keep deployments alive. See the [Neon cleanup guide](https://neon.com/docs/guides/vercel-branch-cleanup).
