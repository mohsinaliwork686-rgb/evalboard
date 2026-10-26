import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "evalboard — see what got worse",
  description:
    "Compare two eval runs case by case: regressions first, then fixes, then every score change. Runs entirely in the browser.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
