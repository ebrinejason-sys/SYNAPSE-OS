import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Synapse OS",
    default: "Synapse OS — AI Health Platform for Africa",
  },
  description:
    "Synapse OS is an AI-powered Health Management Information System built in Uganda. Every department. Every workflow. Every patient step documented, coded, and AI-assisted.",
  keywords: ["HMIS", "health information system", "Uganda", "Africa", "AI diagnosis", "telemedicine"],
  authors: [{ name: "Synapse Health Technologies Ltd" }],
  openGraph: {
    type: "website",
    locale: "en_UG",
    siteName: "Synapse OS",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* FOUC prevention — sets data-theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('synapse-theme');if(!t)t=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t)})()` }} />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
