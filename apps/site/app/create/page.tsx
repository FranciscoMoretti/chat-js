import type { Metadata } from "next";
import { CreateConfigurator } from "@/components/create-configurator";
import { gatewayMetadata } from "../../../../packages/registry/src/gateways/metadata";
import { builtInStorageProviders } from "../../../../packages/registry/src/storage/providers";

export const metadata: Metadata = {
  title: "Create your ChatJS app",
  description:
    "Choose a native shadcn preset and your ChatJS installation options.",
  alternates: { canonical: "/create" },
};

const CreatePage = () => {
  const gateways = Object.entries(gatewayMetadata).map(([id, item]) => ({
    id,
    title: item.exportName.replace(/Gateway$/u, ""),
  }));
  const storageProviders = builtInStorageProviders
    .filter((item) => ["vercel-blob", "s3", "r2"].includes(item.slug))
    .map((item) => ({
      id: item.slug,
      title: item.name,
      configKeys: item.env?.config ?? [],
    }));
  return (
    <CreateConfigurator
      gateways={gateways}
      storageProviders={storageProviders}
    />
  );
};
export default CreatePage;
