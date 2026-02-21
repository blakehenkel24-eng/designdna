import type { Metadata } from "next";
import { Manrope, Orbitron, Space_Mono } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Design DNA",
  description: "Extract website design DNA into LLM-ready artifacts.",
  icons: {
    icon: "/branding/favicon.svg",
    shortcut: "/branding/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Design DNA",
    description: "Extract website design DNA into LLM-ready artifacts.",
  },
  twitter: {
    title: "Design DNA",
    description: "Extract website design DNA into LLM-ready artifacts.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${orbitron.variable} ${spaceMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
