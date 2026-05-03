'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-8">Spark</h1>
      <button
        onClick={handleGoogleLogin}
        className="px-6 py-3 bg-black text-white rounded-lg"
      >
        Google로 시작하기
      </button>
    </main>
  )
}