import { AccountForm } from "./account-form";

export const LoginForm = ({ className }: { readonly className?: string }) => (
  <AccountForm mode="login" className={className} />
);
