import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchTopicCards } from './actions/main'
import MainClient from './MainClient'

const INTRO_BODY = `Spark를 소개합니다. ✦

매일 다른 글감, 쓸수록 내 취향으로.

글이 막히면 AI가 다음 문장을 조용히 제안해요.
✦ 피드백 버튼으로 전체 흐름도 살펴볼 수 있어요.

글은 아카이브에 쌓여요.
쌓일수록 내 생각의 구조가 보여요.`

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 닉네임 + 글감 + 소개 글 존재 여부 병렬 로드
  const [profileResult, initialCards, systemWritingResult] = await Promise.all([
    supabase.from('users').select('nickname').eq('id', user.id).single(),
    fetchTopicCards(user.id, 20),
    supabase
      .from('writings')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_system', true)
      .limit(1),
  ])

  // 소개 글 없으면 자동 생성 (최초 1회)
  if (!systemWritingResult.data?.length) {
    await supabase.from('writings').insert({
      user_id: user.id,
      topic_id: null,
      topic_content: null,
      body: INTRO_BODY,
      is_system: true,
    })
  }

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
