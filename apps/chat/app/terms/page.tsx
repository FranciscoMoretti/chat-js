import { config } from "@/lib/config";

function getPlanTypesLabel({
  hasFree,
  hasPro,
}: {
  hasFree: boolean;
  hasPro: boolean;
}): string {
  if (hasFree && hasPro) {
    return "free and paid";
  }
  if (hasPro) {
    return "paid";
  }
  return "free";
}

function PricingSection({
  hasAnyPlan,
  planTypesLabel,
  hasFree,
  hasPro,
  currencySymbol,
  paymentProcessors,
}: {
  hasAnyPlan: boolean;
  planTypesLabel: string;
  hasFree: boolean;
  hasPro: boolean;
  currencySymbol: string;
  paymentProcessors: string[];
}) {
  if (!hasAnyPlan) {
    return (
      <>
        <p>
          {config.appName} currently does not offer paid plans. If we introduce
          paid features in the future, this section will be updated and you will
          be notified in advance.
        </p>
        {paymentProcessors.length > 0 && (
          <p>
            When payments are enabled, billing will be processed by{" "}
            {paymentProcessors.join(", ")}. We will not store payment card
            details; payment data will be handled directly by our providers
            according to their policies and security standards.
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <p>
        {config.appName} offers {planTypesLabel} subscription plans.
      </p>
      <ul>
        {hasFree && (
          <li>
            <strong>{config.pricing?.free?.name}:</strong>{" "}
            {config.pricing?.free?.summary}
          </li>
        )}
        {hasPro && (
          <li>
            <strong>{config.pricing?.pro?.name}:</strong> {currencySymbol}
            {config.pricing?.pro?.monthlyPrice}/month —{" "}
            {config.pricing?.pro?.summary}
          </li>
        )}
      </ul>
      {paymentProcessors.length > 0 && (
        <p>
          We use third-party payment processors to handle billing and payments:{" "}
          {paymentProcessors.join(", ")}. {config.appName} does not store any
          payment card details, bank information, or other sensitive payment
          data. All payment information is processed directly by our providers.
        </p>
      )}
      {hasPro && (
        <ul>
          <li>Billing is monthly and charged automatically</li>
          <li>All fees are non-refundable except as expressly stated</li>
          <li>We may change prices with 30 days notice</li>
          <li>You are responsible for applicable taxes</li>
          <li>Failed payments may result in suspension or termination</li>
        </ul>
      )}
    </>
  );
}

const TermsPage = () => {
  const currencySymbolMap: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
  };

  const currencyCode = config.pricing?.currency;
  const currencySymbol = currencyCode
    ? (currencySymbolMap[currencyCode] ?? currencyCode)
    : "";
  const hasFree = Boolean(config.pricing?.free);
  const hasPro = Boolean(config.pricing?.pro);
  const hasAnyPlan = hasFree || hasPro;
  const paymentProcessors = Array.isArray(config.services?.paymentProcessors)
    ? config.services.paymentProcessors
    : [];
  const planTypesLabel = getPlanTypesLabel({ hasFree, hasPro });

  return (
    <main className="prose dark:prose-invert container mx-auto max-w-3xl py-10">
      <h1>{config.policies.terms.title}</h1>
      {config.policies.terms.lastUpdated ? (
        <p>
          <strong>Last updated:</strong> {config.policies.terms.lastUpdated}
        </p>
      ) : null}

      <p>
        Welcome to {config.appName}. These Terms of Service govern your use of
        our website and services. By using {config.appName}, you agree to these
        terms in full. If you disagree with any part of these terms, please do
        not use our service.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using {config.appName}, you acknowledge that you have
        read, understood, and agree to be bound by these Terms of Service. We
        reserve the right to modify these terms at any time, and such
        modifications shall be effective immediately upon posting. Your
        continued use of {config.appName} after any modifications indicates your
        acceptance of the modified terms.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        {config.appName} helps users find information using AI. Our service is
        hosted on {config.services.hosting} and integrates with AI technology
        providers including {config.services.aiProviders.join(", ")} to deliver
        results and content generation capabilities.
      </p>

      <h2>3. User Conduct</h2>
      <ul>
        <li>Comply with applicable laws and regulations</li>
        <li>Respect intellectual property rights</li>
        <li>Do not distribute malware or harmful code</li>
        <li>Do not attempt unauthorized access to our systems</li>
        <li>Do not scrape or conduct automated queries</li>
        <li>Do not generate or distribute illegal or harmful content</li>
        <li>Do not interfere with the proper functioning of the service</li>
      </ul>

      <h2>4. Content and Results</h2>
      <ul>
        <li>
          No guarantees on accuracy, completeness, or reliability of results
        </li>
        <li>Generated content is based on your queries</li>
        <li>
          We may link to third-party websites that we do not control; use your
          own judgment
        </li>
      </ul>

      <h2>5. Intellectual Property</h2>
      <p>
        All content, features, and functionality of {config.appName} are the
        property of {config.organization.name} or its licensors and are
        protected by intellectual property laws.
      </p>

      <h2>6. Third-Party Services</h2>
      <p>
        {config.appName} relies on third-party services to provide
        functionality:
      </p>
      <ul>
        <li>Hosting: {config.services.hosting}</li>
        <li>AI providers: {config.services.aiProviders.join(", ")}</li>
        {config.services.paymentProcessors.length > 0 ? (
          <li>
            Payments: {config.services.paymentProcessors.join(", ")} for billing
            and subscription management
          </li>
        ) : null}
      </ul>
      <p>
        These third-party services have their own terms and privacy policies and
        may process your data as described in our Privacy Policy. Payment data
        is processed directly by our payment providers according to their
        respective privacy policies and security standards.
      </p>

      <h2>7. Pricing and Billing</h2>
      <PricingSection
        currencySymbol={currencySymbol}
        hasAnyPlan={hasAnyPlan}
        hasFree={hasFree}
        hasPro={hasPro}
        paymentProcessors={paymentProcessors}
        planTypesLabel={planTypesLabel}
      />

      <h2>8. Cancellation and Refunds</h2>
      <p>
        You may cancel your subscription at any time through your account
        settings or by contacting us. Upon cancellation, your subscription
        remains active until the end of the billing period, after which your
        account reverts to the free plan.
      </p>
      <p>
        <strong>No Refund Policy</strong>: All subscription fees are final and
        non-refundable.
      </p>

      <h2>9. Privacy</h2>
      <p>
        Your use of {config.appName} is also governed by our Privacy Policy,
        which is incorporated by reference.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, {config.organization.name} shall
        not be liable for indirect, incidental, special, consequential, or
        punitive damages.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        {config.appName} is provided &quot;as is&quot; and &quot;as
        available&quot; without any warranties of any kind, either express or
        implied.
      </p>

      <h2>12. Termination</h2>
      <p>
        We may suspend or terminate your access for conduct that violates these
        Terms or is harmful to others, us, or third parties.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms are governed by the laws of {config.legal.governingLaw}.
      </p>

      <h2>14. Contact Us</h2>
      <p>
        If you have any questions about these Terms of Service, contact us at{" "}
        {config.organization.contact.legalEmail}
      </p>

      <p>
        By using {config.appName}, you agree to these Terms of Service and our
        Privacy Policy.
      </p>
    </main>
  );
};

export default TermsPage;
