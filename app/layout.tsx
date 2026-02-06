import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Certificator - Zero-Cost Certificate Generation",
  description: "Create, manage, and generate PDF certificates with custom layouts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
