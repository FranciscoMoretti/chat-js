import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import { siteLinks } from "@/lib/site-config";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { BlockCollection } from "./collection";
import { CreateCommand } from "./command";
import { SourceAnimation } from "./source-animation";
import "../carbon.css";
import "./home.css";

const Actions = () => (
  <div className="actions">
    <Link className="button primary" href="/create">
      Create your app <ArrowUpRight size={15} aria-hidden="true" />
    </Link>
    <a className="button secondary" href={siteLinks.docsGettingStarted}>
      Read the docs <ArrowRight size={15} aria-hidden="true" />
    </a>
  </div>
);

export const Homepage = () => (
  <div className="home-page carbon-page" data-testid="homepage">
    <a className="skip-link" href="#main">
      Skip to content
    </a>
    <Navbar />
    <main id="main" tabIndex={-1}>
      <section className="hero split carbon-wrap" aria-labelledby="home-title">
        <div className="hero-copy">
          <span className="eyebrow">
            <i aria-hidden="true" />
            OPEN SOURCE. YOURS TO BUILD ON.
          </span>
          <h1 id="home-title">
            The building blocks
            <br />
            for your <em>AI app.</em>
          </h1>
          <p className="deck">
            A working chat. Your choice of models.
            <br />
            Tools and plugins. Code you own.
          </p>
          <Actions />
          <CreateCommand />
        </div>
        <iframe
          sandbox="allow-scripts"
          className="kinetic"
          title="Blocks transforming from the ChatJS C into chat and research interfaces"
          src="/home/hero/index.html"
        />
      </section>
      <div className="carbon-wrap">
        <div className="foundation-band">
          <span className="eyebrow">A FOUNDATION, ALREADY WORKING.</span>
          <span>Chat &amp; conversations</span>
          <span>Durable runtime</span>
          <span>Authentication</span>
          <a href={`${siteLinks.docs}/gateways/overview`}>
            Your choice of models <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
      <section
        className="section collection-section"
        id="blocks"
        aria-labelledby="collection-title"
      >
        <div className="carbon-wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">01 / MAKE IT YOURS</span>
              <h2 id="collection-title">
                Choose what
                <br />
                <em>your app can do.</em>
              </h2>
            </div>
            <p>
              Explore the features. Add what you need. Make the code your own.
            </p>
          </div>
          <BlockCollection />
        </div>
      </section>
      <section
        className="source-section"
        id="source"
        aria-labelledby="source-title"
      >
        <div className="carbon-wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">02 / THE SOURCE IS THE PRODUCT</span>
              <h2 id="source-title">You own the code.</h2>
            </div>
            <p>
              Add a capability. Get its source in your project. Read it, change
              it, and make it work your way.
            </p>
          </div>
          <div className="source-frame">
            <div className="source-title">
              <span>FROM CAPABILITY TO CODEBASE</span>
              <a href={`${siteLinks.docs}/cli/add`}>
                How installation works{" "}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
            <SourceAnimation />
          </div>
          <div className="ownership-points">
            <div>
              <span className="eyebrow">01 / INSTALL</span>
              <h3>Choose a capability.</h3>
              <p>Add tools and plugins inside your ChatJS app.</p>
            </div>
            <div>
              <span className="eyebrow">02 / OPEN</span>
              <h3>See how it works.</h3>
              <p>The implementation lives in your project.</p>
            </div>
            <div>
              <span className="eyebrow">03 / ADAPT</span>
              <h3>Take it somewhere new.</h3>
              <p>Change the source to fit your product.</p>
            </div>
          </div>
        </div>
      </section>
      <section
        className="faq section carbon-wrap"
        id="faq"
        aria-labelledby="faq-title"
      >
        <div>
          <span className="eyebrow">A FEW USEFUL DETAILS</span>
          <h2 id="faq-title">
            Built to be
            <br />
            <em>built on.</em>
          </h2>
        </div>
        <div>
          <details>
            <summary>
              What do I get with ChatJS?
              <Plus size={16} aria-hidden="true" />
            </summary>
            <p>
              A working AI chat foundation, with the interface, runtime and
              authentication together. The collection includes built-in features
              and optional capabilities you can install and customize.
            </p>
          </details>
          <details>
            <summary>
              Can I add more later?
              <Plus size={16} aria-hidden="true" />
            </summary>
            <p>
              Yes. Use the CLI inside your ChatJS app to add plugins, tools and
              provider integrations. Each capability documents its setup and
              credential requirements.
            </p>
          </details>
          <details>
            <summary>
              Is ChatJS free to use?
              <Plus size={16} aria-hidden="true" />
            </summary>
            <p>
              Yes. ChatJS is free and open source under the{" "}
              <a href={`${siteLinks.github}/blob/main/LICENSE`}>
                Apache 2.0 license
              </a>
              . Hosting, AI model usage and any other services you connect are
              billed separately by those providers.
            </p>
          </details>
        </div>
      </section>
      <section className="closing carbon-wrap">
        <span className="eyebrow">THE NEXT PART IS YOURS.</span>
        <h2>What will you build?</h2>
        <Actions />
      </section>
    </main>
    <Footer />
  </div>
);
