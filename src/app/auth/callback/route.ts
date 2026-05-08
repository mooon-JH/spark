import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        // Google 프로필에서 닉네임 추출
        const nickname =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split('@')[0] ??
          '익명'

        if (!profile) {
          // 신규 유저 — row 생성 + 닉네임 저장
          await supabase.from('users').insert({
            id: user.id,
            email: user.email,
            nickname,
          })
        } else {
          // 기존 유저 — 닉네임이 없을 경우에만 업데이트
          await supabase
            .from('users')
            .update({ nickname })
            .eq('id', user.id)
            .is('nickname', null)
        }

        return NextResponse.redirect(`${origin}/`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
