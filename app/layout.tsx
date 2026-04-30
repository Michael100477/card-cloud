import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
