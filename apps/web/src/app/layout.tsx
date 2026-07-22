import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Bricolage_Grotesque, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Synapse OS",
    default: "Synapse OS — AI Health Platform for Africa",
  },
  description:
    "Synapse OS is an AI-powered Health Management Information System built in Uganda. Every department. Every workflow. Every patient step documented, coded, and AI-assisted.",
  keywords: ["HMIS", "health information system", "Uganda", "Africa", "AI diagnosis", "telemedicine"],
  authors: [{ name: "Synapse Health Technologies Ltd" }],
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_UG",
    siteName: "Synapse OS",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${bricolage.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        {/* Anti-AI-scraping */}
        <meta name="robots" content="noai, noimageai" />
        {/* FOUC prevention — sets data-theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('synapse-theme');if(!t)t=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t)})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
