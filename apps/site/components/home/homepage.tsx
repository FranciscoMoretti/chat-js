import { RiGithubFill } from "@remixicon/react";
import { Equal, Plus, X } from "lucide-react";
import Link from "next/link";
import { ModeSwitcher } from "@/vendor/shadcn-create/components/mode-switcher";
import { Brand } from "@/components/brand";
import { docsNavigationHref, siteLinks } from "@/lib/site-config";
import { buttonVariants } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { canopyBlocks, canopyBuildDefaults } from "./canopy-catalog";
import { CanopyHero } from "./canopy-hero";
import "../carbon.css";
import "./home.css";

const HomeLinks = () => (
  <>
    <a href={docsNavigationHref}>Docs</a>
    <a href={siteLinks.demo}>Demo</a>
    <Link href="/create">Create</Link>
  </>
);

const HomeHeader = () => (
  <header className="canopy-header">
    <div className="canopy-bar">
      <Brand />
      <nav aria-label="Main">
        <div className="canopy-nav-links">
          <HomeLinks />
        </div>
        <button
          type="button"
          className={buttonVariants({
            variant: "ghost",
            className: "canopy-menu-toggle",
          })}
          popoverTarget="canopy-mobile-menu"
        >
          <Equal aria-hidden="true" absoluteStrokeWidth className="size-5" />
          <X aria-hidden="true" className="size-5" />
          Menu
        </button>
        <div
          id="canopy-mobile-menu"
          className="canopy-mobile-menu"
          popover="auto"
        >
          <HomeLinks />
          <ModeSwitcher showLabel />
        </div>
        <a
          href={siteLinks.github}
          aria-label="ChatJS on GitHub"
          className={buttonVariants({
            variant: "ghost",
            size: "icon",
            className: "canopy-repo",
          })}
        >
          <RiGithubFill aria-hidden="true" className="size-5" />
        </a>
        <ModeSwitcher className="canopy-theme-toggle" />
        <Link
          href="/create"
          className={buttonVariants({ className: "canopy-new" })}
        >
          New <Plus data-icon="inline-end" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  </header>
);

export const Homepage = () => (
  <div className="carbon-page canopy-page" data-testid="homepage">
    <a className="canopy-skip" href="#main">
      Skip to content
    </a>
    <HomeHeader />
    <main id="main" tabIndex={-1}>
      <CanopyHero blocks={canopyBlocks} buildDefaults={canopyBuildDefaults} />
    </main>
    <footer className="canopy-footer">
      <p>
        Built by <a href="https://x.com/franmoretti_">Francisco</a>. Explore the
        source on <a href={siteLinks.github}>GitHub</a>.
      </p>
    </footer>
  </div>
);
