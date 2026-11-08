import { mark } from "@chatjs/brand/identity";
import Link from "next/link";

export const Brand = () => (
  <Link className="logo" href="/" aria-label="ChatJS home">
    <svg viewBox={mark.viewBox} fill="currentColor" aria-hidden="true">
      <path d={mark.path} />
    </svg>
    <span>ChatJS</span>
  </Link>
);
