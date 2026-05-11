import type { Metadata } from "next";
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
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
