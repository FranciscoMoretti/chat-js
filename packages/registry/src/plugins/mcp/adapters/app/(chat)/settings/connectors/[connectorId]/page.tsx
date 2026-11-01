// ChatJS source: mcp. Ownership: chatjs/plugins/mcp/chatjs.json.
import { ConnectorDetailsPage } from "@/chatjs/plugins/mcp/routes/connector-page";

const Page = (props: { readonly params: Promise<{ connectorId: string }> }) => (
  <ConnectorDetailsPage {...props} />
);

export default Page;
