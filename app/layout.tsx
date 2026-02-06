import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter font for UI elements
 * Self-hosted via next/font for optimal performance and bandwidth efficiency
 * Loaded with subset for common Latin characters
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
