import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
})

export const metadata: Metadata = {
  title: "Synapse Pharmacy",
  description: "Synapse Health Technologies - Pharmacy Management Portal",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className="dark scroll-smooth" suppressHydrationWarning>
      <head>
        {/* Explicit Synapse icons — override any browser auto-discovery of favicon.ico */}
        <link rel="icon"          type="image/png" sizes="32x32" href="/logo.png" />
        <link rel="icon"          type="image/png" sizes="16x16" href="/logo.png" />
        <link rel="shortcut icon" type="image/png"               href="/logo.png" />
        <meta name="theme-color" content="#F97316" />
        {/* FOCT prevention - sets theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement,t=localStorage.getItem('pharm-theme')||'dark';d.setAttribute('data-theme',t);if(t==='dark'){d.classList.add('dark');d.classList.remove('light');}else{d.classList.remove('dark');d.classList.add('light');}})();`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
