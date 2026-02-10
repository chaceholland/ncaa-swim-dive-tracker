import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NCAA D1 Swimming & Diving Tracker",
  description: "Track every team, athlete, and performance across Division I swimming and diving. Comprehensive roster data, team statistics, and conference information.",
  keywords: [
    "NCAA",
    "swimming",
    "diving",
    "D1",
    "Division 1",
    "college swimming",
    "college diving",
    "roster",
    "athletes",
    "conferences",
    "SEC",
    "Big Ten",
    "ACC",
    "Big 12",
    "Ivy League",
  ],
  authors: [{ name: "NCAA Swim & Dive Tracker" }],
  openGraph: {
    title: "NCAA D1 Swimming & Diving Tracker",
    description: "Track every team, athlete, and performance across Division I swimming and diving.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
