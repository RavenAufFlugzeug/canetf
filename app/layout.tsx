import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import ViewTransitionGuard from "@/components/ViewTransitionGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LitterBox",
  description: "Investment action plan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Browser extensions (Grammarly, for one) add their own attributes to <body> before
          React takes over; suppressHydrationWarning keeps React from flagging those. It
          covers only <body>'s own attributes, so real mismatches in the page still show. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* The navbar is built once, here, and stays in place as the pages change below it
            (app/template.tsx), so it never resets mid-way: its logo's cat keeps her state. */}
        <Navbar />
        {children}
        {/* While the tab is hidden, pages change without asking to animate (which would fail). */}
        <ViewTransitionGuard />
      </body>
    </html>
  );
}
