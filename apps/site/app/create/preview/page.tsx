import { Suspense } from "react";
import { PreviewModelPreference } from "@/components/create-preview/preview-runtime";
import { ChatPreview } from "@/components/create-preview/chat-preview";
import { DesignSystemProvider } from "@/vendor/shadcn-create/components/design-system-provider";

const CreatePreviewPage = () => (
  <Suspense>
    <DesignSystemProvider>
      <PreviewModelPreference>
        <ChatPreview />
      </PreviewModelPreference>
    </DesignSystemProvider>
  </Suspense>
);
export default CreatePreviewPage;
