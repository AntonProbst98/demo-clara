import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { PromisesProvider } from "@/components/providers/PromisesProvider";
import { TopNav } from "@/components/app/TopNav";

// A deliberate, finance-grade pairing rather than a generic single sans:
// IBM Plex Sans for UI text, IBM Plex Mono for every figure (money, DPD, counts).
// Mono numerals read like a ledger and give real typographic hierarchy.
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-family",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Collections Copilot — Clara",
  description:
    "Internal collections workspace: work delinquent accounts, apply pre-computed policies, and log promises to pay.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <PromisesProvider>
          <TopNav />
          <main>{children}</main>
        </PromisesProvider>
      </body>
    </html>
  );
}
