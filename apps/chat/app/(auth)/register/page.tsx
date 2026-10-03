import type { Metadata } from "next";
import React, { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { SignupForm } from "@/components/signup-form";

/* oxlint-disable import/exports-last, react/only-export-components  --
 * import/exports-last (#522): metadata is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/no-named-export (#527): Preserve the named metadata API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * react/only-export-components (#553): metadata is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
export const metadata: Metadata = {
  description: "Create an account to get started.",
  title: "Create an account",
};
/* oxlint-enable import/exports-last, react/only-export-components */

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
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default RegisterPage;
/* oxlint-enable import/no-default-export */
