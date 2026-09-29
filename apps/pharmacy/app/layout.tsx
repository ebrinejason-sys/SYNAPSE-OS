import type { Metadata } from "next"
import { synapseThemeFoucScript } from "@synapse/config/theme"
import { SynapseThemeProvider } from "@synapse/ui"
import "@synapse/config/typography.css"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

/** Same type stack as synapseos.tech — IBM Plex Sans + Mono. */
export const metadata: Metadata = {
  title: "Synapse Pharm",
  description:
    "POS, FEFO batch inventory, and receipts built for Ugandan pharmacies — Synapse Health Technologies.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="scroll-smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/logo.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logo.png" />
        <link rel="shortcut icon" type="image/png" href="/logo.png" />
        <meta name="theme-color" content="#F97316" />
        <script
          dangerouslySetInnerHTML={{
            __html: synapseThemeFoucScript({ syncDarkLightClass: true }),
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <SynapseThemeProvider>
          {children}
        </SynapseThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
