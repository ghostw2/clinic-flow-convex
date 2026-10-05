import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "./providers";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

// design/tokens.json: font.family "Inter". latin-ext covers Albanian
// diacritics (ë, ç) used throughout the Shqip copy.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "ClinicFlow",
  description: "ClinicFlow -- backend scaffold, UI to follow in the next step.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={cn("font-sans", inter.variable)}>
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
