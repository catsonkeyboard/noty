import './globals.css'
import { Theme } from '@radix-ui/themes';
import { Inter } from 'next/font/google';
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
        <Theme>{children}</Theme>
      </body>
    </html>
  )
}
