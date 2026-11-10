import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";

export const Brand = ({
  className = "carbon-brand",
}: {
  readonly className?: string;
}) => (
  <Link className={className} href="/" aria-label="ChatJS home">
    <BrandMark />
    <span>ChatJS</span>
  </Link>
);
