import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "@synapse/config/typography.css";
import { synapseThemeFoucScript } from '@synapse/config/theme'
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";

/** Shared with pharmacy — IBM Plex Sans (UI + display) · IBM Plex Mono (data). */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-mono",
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
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <head>
        {/* Anti-AI-scraping */}
        <meta name="robots" content="noai, noimageai" />
        {/* FOUC prevention — sets data-theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: synapseThemeFoucScript(),
          }}
        />
      </head>
      <body className="min-h-screen bg-base font-sans text-primary-color antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
