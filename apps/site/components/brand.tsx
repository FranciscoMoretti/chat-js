import { BrandMark } from "@/components/brand-mark";
import "@chatjs/brand/navigation.css";
import Link from "next/link";

export const Brand = ({
  className = "chatjs-home-link",
  children,
}: {
  readonly children?: React.ReactNode;
  readonly className?: string;
}) => (
  <Link className={className} href="/" aria-label="ChatJS home">
    <BrandMark className="size-6 shrink-0" />
    {children}
  </Link>
);
