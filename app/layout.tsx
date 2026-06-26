import type { Metadata, Viewport } from "next"
import { Geist, Fredoka } from "next/font/google"
import ThemeProvider from "@/components/ThemeProvider"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const fredoka = Fredoka({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] })

export const metadata: Metadata = {
  title: "Little Yakka",
  description: "Make chores fun for kids",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Little Yakka",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
}

export const viewport: Viewport = {
  themeColor: "#EC4899",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fredoka.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
