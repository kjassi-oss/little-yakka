import type { Metadata, Viewport } from "next"
import { Baloo_2, Nunito } from "next/font/google"
import ThemeProvider from "@/components/ThemeProvider"
import NativeAuth from "@/components/NativeAuth"
import "./globals.css"

// Playful, friendly type: Nunito for body, Baloo 2 for the chunky display wordmark
const nunito = Nunito({ variable: "--font-body", subsets: ["latin"], weight: ["400", "600", "700", "800"] })
const baloo = Baloo_2({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"] })

export const metadata: Metadata = {
  title: "Little Yakka",
  description: "Make chores fun for kids",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Little Yakka",
  },
  // Favicon comes from app/icon.tsx; the home-screen (apple-touch) icon uses the uploaded logo
  icons: {
    apple: "/logo.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0EA5E9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} ${baloo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NativeAuth />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
