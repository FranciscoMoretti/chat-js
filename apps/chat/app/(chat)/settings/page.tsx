import React from "react";

const GeneralSettingsPage = (): React.JSX.Element => (
  <div className="space-y-6">
    <div>
      <h2 className="text-lg font-semibold">General</h2>
      <p className="text-muted-foreground text-sm">
        General settings will be available here soon.
      </p>
    </div>
  </div>
);

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component GeneralSettingsPage.
export default GeneralSettingsPage;
