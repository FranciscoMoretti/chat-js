"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useState } from "react";
import { docsNavigationHref } from "@/lib/site-config";
import { buttonVariants } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import {
  initialCanopySelection,
  toggleCanopyBlock,
  canopyCreateHref,
} from "./canopy-build";
import type { canopyBuildDefaults } from "./canopy-catalog";
import { CanopyField } from "./canopy-field";
import { CreateCommand } from "./command";

export const CanopyHero = ({
  blocks,
  buildDefaults,
}: Pick<ComponentProps<typeof CanopyField>, "blocks"> & {
  readonly buildDefaults: typeof canopyBuildDefaults;
}) => {
  const [selected, setSelected] = useState(() =>
    initialCanopySelection(buildDefaults)
  );
  return (
    <section className="canopy-hero" aria-labelledby="home-title">
      <div className="canopy-intro">
        <h1 id="home-title">The building blocks for your AI app.</h1>
        <p>
          Pick the pieces you need and get a chat app you can make your own.
        </p>
        <div className="canopy-actions">
          <Link
            className={buttonVariants({ className: "canopy-build" })}
            href={canopyCreateHref(selected, buildDefaults)}
            prefetch={false}
          >
            Build your app{" "}
            <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
          </Link>
          <a
            className={buttonVariants({ variant: "ghost" })}
            href={`${docsNavigationHref}/quickstart`}
          >
            Read the docs{" "}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </a>
        </div>
        <CreateCommand />
      </div>
      <CanopyField
        blocks={blocks}
        selected={selected}
        onToggle={(id) => {
          setSelected((previous) => toggleCanopyBlock(previous, id));
        }}
      />
      <div className="canopy-fade" aria-hidden="true" />
    </section>
  );
};
