import { colors } from "@chatjs/brand/identity";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { previewFontVariables } from "@/vendor/shadcn-create/preview/fonts";
import { PreviewFontVariables } from "@/vendor/shadcn-create/preview/font-variables";
import "./create.css";

const brandVariables = Object.entries(colors)
  .map(([name, value]) => `--chatjs-${name}:${value}`)
  .join(";");

const CreateLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <NuqsAdapter>
    <style>{`html:has(.chatjs-create-shell){${brandVariables}}`}</style>
    <PreviewFontVariables className={previewFontVariables} />
    {children}
    <Toaster />
  </NuqsAdapter>
);
export default CreateLayout;
