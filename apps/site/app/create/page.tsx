import { ViewTransition } from "react";
import type { Metadata } from "next";
import { CreateConfigurator } from "@/components/create-configurator";
import { registryItems } from "../../../../packages/registry/registry-items";
import { storageItems } from "../../../../packages/registry/src/storage/items";
import { installationCatalog } from "../../../../packages/registry/installation-catalog";

export const metadata: Metadata = {
  title: "Create your ChatJS app",
  description:
    "Choose a native shadcn preset and your ChatJS installation options.",
  alternates: { canonical: "/create" },
};

const CreatePage = () => (
  <ViewTransition name="section-page" default="none" share="section-fade">
    <CreateConfigurator
      catalog={installationCatalog([...registryItems, ...storageItems])}
    />
  </ViewTransition>
);
export default CreatePage;
