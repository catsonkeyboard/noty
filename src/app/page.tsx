'use client'
import Image from 'next/image'
import { invoke } from '@tauri-apps/api/tauri'
import { useEffect,useState } from 'react'

export default function HomePage() {
  const [greet, setGreet] = useState<string>('111')
  useEffect(() => {
    invoke<string>('greet', { name: 'Next.js' })
      .then(p => {
        console.log(p)
        setGreet(p)
      })
      .catch(console.error)
  }, [])

  return (
    <div>
        default page
    </div>
  )
}
