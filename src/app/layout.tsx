import './globals.css'
import { Inter } from 'next/font/google'
import { Theme } from '@radix-ui/themes'
import dynamic from "next/dynamic"
const Directory = dynamic(() => import("@/components/Directory"), {
  ssr: false,
});
const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'noty',
  description: 'a markdown note app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Theme>
          <main className="relative w-full h-screen flex flex-col bg-primary-foreground select-none overflow-hidden">
            <div className="relative w-full h-full flex">
                <Directory />
                {children}
            </div>
          </main>
        </Theme>
      </body>
    </html>
  )
}
