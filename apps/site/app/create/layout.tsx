import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { previewFontVariables } from "@/vendor/shadcn-create/preview/fonts";
import { PreviewFontVariables } from "@/vendor/shadcn-create/preview/font-variables";
import "./create.css";

const CreateLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <NuqsAdapter>
    <PreviewFontVariables className={previewFontVariables} />
    {children}
    <Toaster />
  </NuqsAdapter>
);
export default CreateLayout;
