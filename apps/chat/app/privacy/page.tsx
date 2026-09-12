import { config } from "@/lib/config";

const PrivacyPage = () => (
  <main className="prose dark:prose-invert container mx-auto max-w-3xl py-10">
    <h1>{config.policies.privacy.title}</h1>
    {config.policies.privacy.lastUpdated ? (
      <p>
        <strong>Last updated:</strong> {config.policies.privacy.lastUpdated}
      </p>
    ) : null}

    <p>
      At {config.organization.name}, we respect your privacy and are committed
      to protecting your personal data. This Privacy Policy explains how we
      collect, use, and safeguard your information when you use our service.
    </p>

    <h2>Information We Collect</h2>
    <p>We may collect the following types of information:</p>
    <ul>
      <li>
        <strong>Search Queries</strong>: The questions and searches you submit
        to our service.
      </li>
      <li>
        <strong>Usage Data</strong>: Information about how you interact with our
        service, including features used and time spent on the platform.
      </li>
      <li>
        <strong>Device Information</strong>: Information about your device,
        browser type, IP address, and operating system.
      </li>
      <li>
        <strong>Account Information</strong>: Email address and profile
        information when you create an account.
      </li>
      <li>
        <strong>Subscription Data</strong>: Information about your subscription
        status and billing history (but not payment details).
      </li>
      <li>
        <strong>Cookies and Similar Technologies</strong>: We use cookies and
        similar tracking technologies to enhance your experience and collect
        usage information.
      </li>
    </ul>
    <p>
      <strong>Important Note on Payment Data</strong>:{" "}
      {config.organization.name} does not collect, store, or process any payment
      card details, bank information, or other sensitive payment data. All
      payment information is handled directly by our payment processors (
      {config.services.paymentProcessors.join(", ")}) and is subject to their
      respective privacy policies and security standards.
    </p>

    <h2>How We Use Your Information</h2>
    <ul>
      <li>To provide and improve our service</li>
      <li>To understand how users interact with our platform</li>
      <li>To personalize and enhance your experience</li>
      <li>To monitor and analyze usage patterns and trends</li>
      <li>To detect, prevent, and address technical issues</li>
    </ul>

    <h2>Data Sharing and Disclosure</h2>
    <p>We may share your information in the following circumstances:</p>
    <ul>
      <li>
        <strong>Service Providers</strong>: With third-party service providers
        who help us operate, improve, and analyze our service.
      </li>
      <li>
        <strong>Hosting</strong>: {config.services.hosting} hosts our
        infrastructure.
      </li>
      <li>
        <strong>AI Processing Partners</strong>: We utilize services from
        companies including {config.services.aiProviders.join(", ")} to process
        queries and provide results.
      </li>
      <li>
        <strong>Payment Processors</strong>: We use{" "}
        {config.services.paymentProcessors.join(", ")} to process payments and
        manage subscriptions. These providers handle all payment data directly
        and have their own privacy policies governing payment information.
      </li>
      <li>
        <strong>Compliance with Laws</strong>: When required by applicable law,
        regulation, legal process, or governmental request.
      </li>
      <li>
        <strong>Business Transfers</strong>: In connection with a merger,
        acquisition, or sale of assets.
      </li>
    </ul>
    <p>
      <strong>Payment Data</strong>: When you make a payment, your payment
      information is transmitted directly to our payment processors and is not
      stored on our servers. We only receive confirmation of successful payments
      and subscription status updates.
    </p>

    <h2>Data Security</h2>
    <p>
      We implement appropriate technical and organizational measures to protect
      your personal information. However, no method of transmission over the
      Internet or electronic storage is 100% secure, and we cannot guarantee
      absolute security.
    </p>

    <h2>Your Rights</h2>
    <p>Depending on your location, you may have the right to:</p>
    <ul>
      <li>Access the personal information we hold about you</li>
      <li>Request correction or deletion of your personal information</li>
      <li>Object to or restrict certain processing activities</li>
      <li>Data portability</li>
      <li>Withdraw consent where applicable</li>
    </ul>

    <h2>Children&apos;s Privacy</h2>
    <p>
      Our service is not directed to children under the age of
      {` ${config.legal.minimumAge}`}. We do not knowingly collect personal
      information from children under
      {` ${config.legal.minimumAge}`}. If you are a parent or guardian and
      believe your child has provided us with personal information, please
      contact us.
    </p>

    <h2>Changes to This Privacy Policy</h2>
    <p>
      We may update our Privacy Policy from time to time. We will notify you of
      any changes by posting the new Privacy Policy on this page and updating
      the &quot;Last updated&quot; date.
    </p>

    <h2>Contact Us</h2>
    <p>
      If you have any questions about this Privacy Policy, please contact us at:{" "}
      {config.organization.contact.privacyEmail}
    </p>

    <p>
      By using {config.appName}, you agree to our Privacy Policy and our Terms
      of Service.
    </p>
  </main>
);

export default PrivacyPage;
