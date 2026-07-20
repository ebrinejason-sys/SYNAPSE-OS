import type { Metadata } from "next"
import { IBM_Plex_Mono, Outfit, Syne } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
})

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
})

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
      data-theme="dark"
      className={`dark scroll-smooth ${outfit.variable} ${syne.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/logo.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logo.png" />
        <link rel="shortcut icon" type="image/png" href="/logo.png" />
        <meta name="theme-color" content="#F97316" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement,t=localStorage.getItem('pharm-theme')||'dark';d.setAttribute('data-theme',t);if(t==='dark'){d.classList.add('dark');d.classList.remove('light');}else{d.classList.remove('dark');d.classList.add('light');}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
