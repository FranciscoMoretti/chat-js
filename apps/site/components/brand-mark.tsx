import { mark } from "@chatjs/brand/identity";

export const BrandMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox={mark.viewBox}
  >
    <path d={mark.path} />
  </svg>
);
