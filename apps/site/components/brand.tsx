import { mark } from "@chatjs/brand/identity";
import Link from "next/link";

export const Brand = ({
  className = "logo",
}: {
  readonly className?: string;
}) => (
  <Link className={className} href="/" aria-label="ChatJS home">
    <svg
      className="size-6 shrink-0"
      viewBox={mark.viewBox}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={mark.path} />
    </svg>
    <span>ChatJS</span>
  </Link>
);
