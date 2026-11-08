import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";

export const Brand = () => (
  <Link className="carbon-brand" href="/" aria-label="ChatJS home">
    <BrandMark />
    <span>ChatJS</span>
  </Link>
);
