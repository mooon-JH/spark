import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 로그인한 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // users 테이블에 온보딩 완료 여부 확인
        const { data: profile } = await supabase
          .from('users')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single()

        // 신규 유저면 users 테이블에 row 생성
        if (!profile) {
          await supabase.from('users').insert({
            id: user.id,
            email: user.email,
            onboarding_completed: false,
          })
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // 온보딩 완료 여부에 따라 분기
        if (profile.onboarding_completed) {
          return NextResponse.redirect(`${origin}/`)
        } else {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }
    }
  }

  // 에러 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login`)
}