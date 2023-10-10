import './globals.css'
import { Inter } from 'next/font/google'
import { Theme } from '@radix-ui/themes'
import Directory from '@/components/Directory'

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
                <div>{children}</div>
            </div>
          </main>
        </Theme>
      </body>
    </html>
  )
}
