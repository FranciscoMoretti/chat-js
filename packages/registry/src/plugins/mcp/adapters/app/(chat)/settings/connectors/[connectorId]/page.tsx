import { ConnectorDetailsPage } from "@/plugins/mcp/routes/connector-page";

const Page = (props: { readonly params: Promise<{ connectorId: string }> }) => (
  <ConnectorDetailsPage {...props} />
);

export default Page;
