import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";

// Render every page on-demand instead of statically prerendering at build
// time. Required because most pages query the DB (SiteFooter loads links,
// landing widgets read settings) and the DB isn't reachable during the
// Railway build step — only at start time after `prisma migrate deploy`.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Card Cloud — Track, Sell, Consign & Trade Sports Cards",
  description:
    "Free sports card collection tracking with live eBay values. Fast cash offers, eBay consignment, and safe card trading — all from one platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
