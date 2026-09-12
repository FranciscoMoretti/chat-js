import { ArrowUpRight } from "lucide-react";

import { siteLinks } from "@/lib/site-config";

/* ── Platform logo icons ──────────────────────────────────────────── */

const AppleLogo = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const WindowsLogo = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M3 12V6.75l6-1.32v6.48L3 12zm6.73-.07l8.27-.9V3.12l-8.27 1.24v7.57zM18 12.08l-8.27.9v7.57l8.27 1.24V12.08zM9 12.1l-6 .09v5.16l6 1.32V12.1z" />
  </svg>
);

const LinuxLogo = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333a.506.506 0 00-.391-.135.544.544 0 00-.368.135c-.112.087-.132.204-.182.335a.87.87 0 00-.066.334v.02c.006.08.018.199.045.268-.145-.063-.324-.145-.497-.202a1.309 1.309 0 01-.076-.468v-.067c.006-.354.086-.7.223-.926.145-.325.355-.523.59-.658.21-.135.447-.202.717-.202z" />
  </svg>
);

const BrowserFrame = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 120 80"
  >
    <rect
      height="72"
      rx="8"
      stroke="currentColor"
      strokeOpacity="0.25"
      strokeWidth="1"
      width="112"
      x="4"
      y="4"
    />
    <line
      stroke="currentColor"
      strokeOpacity="0.15"
      strokeWidth="1"
      x1="4"
      x2="116"
      y1="20"
      y2="20"
    />
    <circle cx="16" cy="12" fill="currentColor" opacity="0.2" r="2.5" />
    <circle cx="24" cy="12" fill="currentColor" opacity="0.15" r="2.5" />
    <circle cx="32" cy="12" fill="currentColor" opacity="0.1" r="2.5" />
    <rect
      fill="currentColor"
      height="6"
      opacity="0.1"
      rx="3"
      width="40"
      x="42"
      y="9"
    />
  </svg>
);

/* ── Main Component ───────────────────────────────────────────────── */

export const Platforms = () => (
  <section
    aria-labelledby="platforms-heading"
    className="relative overflow-hidden py-28 sm:py-36"
  >
    {/* Background atmosphere */}
    <div className="pointer-events-none absolute inset-0">
      <div className="bg-foreground/[0.02] absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-[20%] h-[400px] w-[500px] rounded-full bg-amber-500/[0.015] blur-[120px] dark:bg-amber-400/[0.025]" />
      <div className="absolute top-[40%] right-[15%] h-[350px] w-[400px] rounded-full bg-indigo-500/[0.012] blur-[100px] dark:bg-indigo-400/[0.02]" />
    </div>

    <div className="relative mx-auto max-w-6xl px-6">
      {/* ── Header ── */}
      <div className="mb-20 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-foreground/50 font-mono text-[11px] tracking-[0.35em] uppercase">
            Platforms
          </p>
          <h2
            className="font-display mt-5 max-w-xl text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
            id="platforms-heading"
          >
            Use it on the <span className="italic">web</span>,
            <br className="hidden sm:block" /> or on{" "}
            <span className="italic">desktop</span>
          </h2>
        </div>
        <p className="text-foreground/60 max-w-sm text-[15px] leading-relaxed lg:text-right">
          Start in the browser instantly. Or read the desktop guide to learn how
          to install the native app.
        </p>
      </div>

      {/* ── Cards ── */}
      <div className="grid gap-4 lg:grid-cols-5 lg:gap-5">
        {/* Web — spans 3 columns */}
        <a
          className="platform-card group border-border/40 bg-card/60 hover:border-foreground/15 hover:bg-card/90 hover:shadow-foreground/[0.04] relative flex flex-col justify-between overflow-hidden rounded-2xl border p-8 backdrop-blur-sm transition-all duration-500 hover:shadow-2xl sm:p-10 lg:col-span-3 lg:min-h-[360px]"
          href={siteLinks.demo}
        >
          {/* Hover glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/[0.06] opacity-0 blur-[80px] transition-opacity duration-700 group-hover:opacity-100 dark:bg-amber-400/[0.08]" />

          <div className="relative z-10">
            <div className="border-foreground/[0.08] bg-foreground/[0.04] inline-flex items-center gap-2 rounded-full border px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-500/40" />
              <span className="text-foreground/60 font-mono text-[10px] tracking-[0.2em] uppercase">
                Live
              </span>
            </div>

            <h3 className="font-display mt-8 text-3xl tracking-tight sm:text-4xl">
              Web
            </h3>
            <p className="text-foreground/55 mt-4 max-w-md text-[15px] leading-relaxed">
              Open ChatJS instantly at{" "}
              <span className="text-foreground/70 font-mono text-sm">
                demo.chatjs.dev
              </span>
              . No install, no sign-up friction. The full experience, right in
              your browser.
            </p>
          </div>

          {/* Browser illustration */}
          <div className="relative z-10 mt-8 flex items-end justify-between">
            <span className="text-foreground/70 group-hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors duration-300">
              Launch web app
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
            <BrowserFrame className="text-foreground/60 hidden h-20 w-auto transition-transform duration-500 group-hover:scale-105 sm:block" />
          </div>
        </a>

        {/* Desktop — spans 2 columns, single card with horizontal buttons */}
        <div
          className="platform-card border-border/40 bg-card/60 relative flex flex-col justify-between overflow-hidden rounded-2xl border p-8 backdrop-blur-sm sm:p-10 lg:col-span-2"
          style={{ animationDelay: "0.08s" }}
        >
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-500/[0.04] blur-[80px] dark:bg-indigo-400/[0.06]" />

          <div className="relative z-10">
            <div className="border-foreground/[0.08] bg-foreground/[0.04] inline-flex items-center gap-2 rounded-full border px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_1px] shadow-indigo-400/40" />
              <span className="text-foreground/60 font-mono text-[10px] tracking-[0.2em] uppercase">
                Native
              </span>
            </div>
            <h3 className="font-display mt-8 text-3xl tracking-tight sm:text-4xl">
              Desktop
            </h3>
            <p className="text-foreground/55 mt-4 text-[15px] leading-relaxed">
              Packaged for macOS, Windows, and Linux. Builds are currently
              unsigned, so the install guide walks you through the OS warnings.
            </p>
          </div>

          <div className="relative z-10 mt-8 flex flex-col gap-2.5">
            <a
              className="group border-border/50 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.07] inline-flex items-center gap-3 rounded-xl border px-5 py-3.5 transition-all duration-300"
              href={siteLinks.docsDesktopMac}
            >
              <AppleLogo className="text-foreground/70 group-hover:text-foreground h-5 w-5 transition-colors" />
              <span className="text-foreground/75 group-hover:text-foreground text-sm font-medium transition-colors">
                macOS
              </span>
            </a>
            <a
              className="group border-border/50 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.07] inline-flex items-center gap-3 rounded-xl border px-5 py-3.5 transition-all duration-300"
              href={siteLinks.docsDesktopWindows}
            >
              <WindowsLogo className="text-foreground/70 group-hover:text-foreground h-5 w-5 transition-colors" />
              <span className="text-foreground/75 group-hover:text-foreground text-sm font-medium transition-colors">
                Windows
              </span>
            </a>
            <a
              className="group border-border/50 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.07] inline-flex items-center gap-3 rounded-xl border px-5 py-3.5 transition-all duration-300"
              href={siteLinks.docsDesktopLinux}
            >
              <LinuxLogo className="text-foreground/70 group-hover:text-foreground h-5 w-5 transition-colors" />
              <span className="text-foreground/75 group-hover:text-foreground text-sm font-medium transition-colors">
                Linux
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
);
