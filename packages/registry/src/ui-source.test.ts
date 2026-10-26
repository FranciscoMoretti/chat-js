import { expect, test } from "bun:test";
import { transformUiSource } from "../ui-source";

test("Base source and unrelated render APIs are preserved byte for byte", () => {
  const source = `import { Controller } from "react-hook-form";
import { MessageScrollerButton } from "@/components/ui/message-scroller";
const view = <><Controller render={({field}) => <input {...field} />} /><MessageScrollerButton render={<button />} /></>;`;
  expect(transformUiSource(source, "view.tsx", "radix")).toBe(source);
  expect(transformUiSource(source, "view.tsx", "base")).toBe(source);
});

test("Radix native slots preserve nested triggers, children, aliases and refs", () => {
  const source = `import { PopoverTrigger as Trigger } from "@/components/ui/popover";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
const view = <Trigger render={<DropdownMenuItem render={<a href='/share' />} ref={ref} />} nativeButton={false}>Share</Trigger>;`;
  const output = transformUiSource(source, "view.tsx", "radix");
  expect(output).toContain(
    "<Trigger asChild><DropdownMenuItem ref={ref} asChild><a href="
  );
  expect(output).toContain(">Share</a></DropdownMenuItem>");
  expect(output).not.toContain("nativeButton");
});

test("menu actions retain their handler while preventing selection dismissal", () => {
  const source = `import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
const item = <DropdownMenuItem closeOnClick={false} onClick={onShare}>Share</DropdownMenuItem>;`;
  const output = transformUiSource(source, "share.tsx", "radix");
  expect(output).not.toContain("closeOnClick");
  expect(output).toContain("event.preventDefault()");
  expect(output).toContain("onClick={onShare}");
  const dismissing = transformUiSource(
    source.replace("closeOnClick={false}", "closeOnClick"),
    "share.tsx",
    "radix"
  );
  expect(dismissing).not.toContain("closeOnClick");
  expect(dismissing).not.toContain("onSelect");
});

test("optional editable bubbles keep both their button and readonly div", () => {
  const source = `import { BubbleContent } from "@/components/ui/bubble";
const bubble = <BubbleContent render={onEdit ? (<button onClick={onEdit} />) : undefined}><pre>{text}</pre></BubbleContent>;`;
  const output = transformUiSource(source, "user-message-view.tsx", "radix");
  expect(output).toContain(
    "<BubbleContent asChild>{onEdit ? <button onClick={onEdit}><pre>{text}</pre></button> : <div><pre>{text}</pre></div>}</BubbleContent>"
  );
});

test("readonly native checkboxes use ARIA without disabling their containing row", () => {
  const source = `import { Checkbox } from "@/components/ui/checkbox";
const checkbox = <Checkbox aria-hidden readOnly checked={selected} tabIndex={-1} />;`;
  const output = transformUiSource(source, "model-selector.tsx", "radix");
  expect(output).toContain("aria-readonly");
  expect(output).not.toContain("readOnly");
  expect(output).not.toContain("disabled");
});

test("Radix search relies on its native nested dialog backdrop without dead imports", () => {
  const source = `import { createPortal } from "react-dom";
import { Dialog, DialogOverlay, DialogContent } from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
const Search = () => { const { isMobile, openMobile, setOpenMobile } = useSidebar(); return <Dialog>{/* Base UI omits nested backdrops. */}{open && isMobile && openMobile && createPortal(<DialogOverlay forceRender />, document.body)}<DialogContent onClick={() => setOpenMobile(false)} /></Dialog>; };`;
  const output = transformUiSource(
    source,
    "plugins/search/search-chats.tsx",
    "radix"
  );
  expect(output).not.toContain("createPortal");
  expect(output).not.toContain("DialogOverlay");
  expect(output).not.toContain("isMobile");
  expect(output).not.toContain("openMobile");
  expect(output).toContain("setOpenMobile");
  expect(output).toContain("DialogContent");
});

test("Radix slots preserve prebuilt elements and native selectors without touching form render", () => {
  const source = `import { TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { Controller } from "react-hook-form";
const view = <><TooltipTrigger render={button} /><DropdownMenuContent className="data-open:bg-muted w-[var(--anchor-width)]" /><Controller render={renderField} /></>;`;
  const output = transformUiSource(source, "view.tsx", "radix");
  expect(output).toContain("<TooltipTrigger asChild>{button}</TooltipTrigger>");
  expect(output).toContain(
    "data-[state=open]:bg-muted w-[var(--radix-dropdown-menu-trigger-width)]"
  );
  expect(output).toContain("<Controller render={renderField}/>");
});

test("context timing moves to the native Radix root and Select keeps inline options", () => {
  const source = `import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { Select } from "@/components/ui/select";
const root = <HoverCard {...props} />;
const trigger = <HoverCardTrigger delay={0} closeDelay={0} render={<button>Context</button>} />;
const select = <Select items={{a: "A"}} value={value}>{options}</Select>;`;
  const output = transformUiSource(
    source,
    "components/ai-elements/context.tsx",
    "radix"
  );
  expect(output).toContain(
    "<HoverCard openDelay={0} closeDelay={0} {...props}/>"
  );
  expect(output).toContain(
    "<HoverCardTrigger asChild><button>Context</button></HoverCardTrigger>"
  );
  expect(output).toContain("<Select value={value}>{options}</Select>");
  expect(
    transformUiSource(output, "components/ai-elements/context.tsx", "radix")
  ).toBe(output);
});

test("native direction context follows the library API", () => {
  const source = `import { DirectionProvider } from "@/components/ui/direction";
const app = <DirectionProvider direction={rtl ? "rtl" : "ltr"}>{children}</DirectionProvider>;`;
  expect(transformUiSource(source, "app/layout.tsx", "radix")).toContain(
    'dir={rtl ? "rtl" : "ltr"}'
  );
  expect(transformUiSource(source, "app/layout.tsx", "base")).toBe(source);
});
