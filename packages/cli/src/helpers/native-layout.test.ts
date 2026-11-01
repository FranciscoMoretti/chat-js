import { expect, test } from "bun:test";
import { cleanNativeLayoutImports } from "./native-layout";

test("removes the replaced font import while preserving selected fonts, types and JSX", () => {
  const source = `import { Geist, Geist_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Provider } from "./provider";
import "./globals.css";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
export const Layout = ({children}: {children: ReactNode}) => <html className={inter.variable + mono.variable}><Provider>{children}</Provider></html>;
`;
  const cleaned = cleanNativeLayoutImports(source);
  expect(cleaned).not.toMatch(/\bGeist\b/u);
  expect(cleaned).toContain("Geist_Mono");
  expect(cleaned).toContain("Inter");
  expect(cleaned).toContain('import type { ReactNode } from "react"');
  expect(cleaned).toContain('import { Provider } from "./provider"');
  expect(cleaned).toContain('import "./globals.css"');
  expect(cleaned.slice(cleaned.indexOf("const inter"))).toBe(
    source.slice(source.indexOf("const inter"))
  );
  expect(cleanNativeLayoutImports(cleaned)).toBe(cleaned);
});
