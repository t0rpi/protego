import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROTEGO",
  description: "PROTEGO — infrastructura de siguranță personală a României.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
