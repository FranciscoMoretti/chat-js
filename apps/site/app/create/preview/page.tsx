import { Suspense } from "react";
import { ChatPreview } from "@/components/create-preview/chat-preview";
import { DesignSystemProvider } from "@/vendor/shadcn-create/components/design-system-provider";

const CreatePreviewPage = () => (
  <Suspense>
    <DesignSystemProvider>
      <ChatPreview />
    </DesignSystemProvider>
  </Suspense>
);
export default CreatePreviewPage;
