import React from "react";
/* oxlint-disable react/jsx-no-literals -- GeneralSettingsPage: react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration. */

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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default GeneralSettingsPage;
/* oxlint-enable import/no-default-export */
