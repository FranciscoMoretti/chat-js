import { AccountForm } from "./account-form";

export const SignupForm = ({ className }: { readonly className?: string }) => (
  <AccountForm mode="register" className={className} />
);
