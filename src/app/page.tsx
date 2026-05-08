import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchTopicCards } from './actions/main'
import MainClient from './MainClient'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 닉네임 + 글감 병렬 로드
  const [profileResult, initialCards] = await Promise.all([
    supabase.from('users').select('nickname').eq('id', user.id).single(),
    fetchTopicCards(user.id, 20),
  ])

  const nickname =
    profileResult.data?.nickname ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    '익명'

  return (
    <MainClient
      userId={user.id}
      nickname={nickname}
      initialCards={initialCards}
    />
  )
}
