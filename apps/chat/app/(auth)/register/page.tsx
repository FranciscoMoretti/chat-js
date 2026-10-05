import type { Metadata } from "next";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { SignupForm } from "@/components/signup-form";

const metadata: Metadata = {
  description: "Create an account to get started.",
  title: "Create an account",
};

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth --
 * react-perf/jsx-no-jsx-as-prop (#555): RegisterPage creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/jsx-max-depth (#548): RegisterPage keeps related render components together; extraction changes component, state, and layout boundaries.
 */
const RegisterPage = (): React.JSX.Element => (
  <div className="container m-auto flex h-dvh w-screen flex-col items-center justify-center px-4">
    <div className="mx-auto w-full sm:w-[480px]">
      <Suspense
        fallback={
          <AuthCardSkeleton
            description="Get started in seconds"
            title="Create an account"
          />
        }
      >
        <SignupForm />
      </Suspense>
    </div>
  </div>
);
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (metadata); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth */

/* oxlint-disable react/only-export-components -- Next.js reads metadata/viewport from this page/layout module alongside its default component; these are framework metadata exports, not reusable component exports. */
export { metadata };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-disable import/no-default-export -- Next.js discovers this page/layout through its default component entrypoint. */
export default RegisterPage;
/* oxlint-enable import/no-default-export */
