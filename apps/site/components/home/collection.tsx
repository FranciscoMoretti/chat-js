"use client";

import Image from "next/image";
import { ArrowUpRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { siteLinks } from "@/lib/site-config";
import { blocks } from "./blocks";

type Block = (typeof blocks)[number];

const Artwork = ({
  block,
  priority = false,
}: {
  block: Block;
  priority?: boolean;
}) => (
  <Image
    src={`/home/blocks/${block.id}.svg`}
    width={320}
    height={320}
    alt={block.name}
    loading={priority ? "eager" : "lazy"}
    unoptimized
  />
);

export const BlockCollection = () => {
  const [selected, setSelected] = useState<Block | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <div className="collection-toolbar">
        <span className="eyebrow">
          THE COLLECTION <span>{blocks.length} BLOCKS</span>
        </span>
        <span className="browse-note">Choose a block to look inside</span>
      </div>
      <div className="catalog-grid">
        {blocks.map((block) => (
          <button
            type="button"
            className="block"
            key={block.id}
            aria-label={`Explore ${block.name}`}
            aria-haspopup="dialog"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setSelected(block);
              dialog.current?.showModal();
            }}
          >
            <Artwork block={block} />
            <span className="block-arrow" aria-hidden="true">
              <ArrowUpRight size={17} />
            </span>
          </button>
        ))}
        <a className="next-block" href={`${siteLinks.docs}/plugins/overview`}>
          <Plus size={32} strokeWidth={1.5} aria-hidden="true" />
          <h3>Your next block.</h3>
          <p>Take the kit somewhere new.</p>
          <small>
            Build a plugin <ArrowUpRight size={12} aria-hidden="true" />
          </small>
        </a>
      </div>
      <div className="collection-bottom">
        <span>The whole collection. Ready when you are.</span>
        <span>
          Included features + optional capabilities · Setup varies by block
        </span>
      </div>
      <dialog
        ref={dialog}
        className="block-dialog"
        aria-labelledby="block-dialog-title"
        onClose={() => trigger.current?.focus()}
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Close block details"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
        {selected && (
          <div className="dialog-body">
            <div className="dialog-art">
              <Artwork block={selected} priority />
              <span>ILLUSTRATED PRODUCT PREVIEW</span>
            </div>
            <div className="dialog-info">
              <span className="eyebrow">{selected.category.toUpperCase()}</span>
              <h2 id="block-dialog-title">{selected.name}</h2>
              <h3>{selected.summary}</h3>
              <p>{selected.body}</p>
              {selected.command && (
                <div className="dialog-command">
                  <code>{selected.command}</code>
                </div>
              )}
              <p className="setup-note">{selected.note}</p>
              <div className="actions">
                <a
                  className="button primary"
                  href={`${siteLinks.docs}/${selected.path}`}
                >
                  Read the docs <ArrowUpRight size={15} aria-hidden="true" />
                </a>
                <Link href="/create">
                  Open Create <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
};
