'use server'

import { createClient } from '@/lib/supabase/server'

export type TopicCard = {
  id: string
  content: string
}

// 글감 N개 랜덤 뽑기 (MVP — 전체 랜덤 노출)
// 비유: 카드 덱 전체를 셔플해서 아직 안 본 카드만 꺼내는 것
export async function fetchTopicCards(
  userId: string,
  count: number = 20
): Promise<TopicCard[]> {
  const supabase = await createClient()

  // 오늘 이미 본 글감 ID 목록
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: seen } = await supabase
    .from('user_seen_topics')
    .select('topic_id')
    .eq('user_id', userId)

  const seenIds = seen?.map((s) => s.topic_id) ?? []

  // 안 본 글감 중 랜덤으로 count개 뽑기
  let query = supabase
    .from('topics')
    .select('id, content')
    .limit(count * 3) // 넉넉히 가져와서 클라이언트에서 셔플

  if (seenIds.length > 0) {
    query = query.not('id', 'in', `(${seenIds.join(',')})`)
  }

  const { data: topics } = await query

  if (!topics?.length) return []

  // 셔플 후 count개 반환
  const shuffled = [...topics].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map((t) => ({
    id: t.id,
    content: t.content,
  }))
}

// 글감 좋아요 / 싫어요 기록
export async function recordTopicFeedback(
  userId: string,
  topicId: string,
  feedback: 'like' | 'dislike'
): Promise<void> {
  const supabase = await createClient()

  const expiresAt =
    feedback === 'dislike'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30일 후
      : null // 좋아요는 영구 기록

  await supabase
    .from('user_seen_topics')
    .upsert(
      {
        user_id: userId,
        topic_id: topicId,
        expires_at: expiresAt,
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,topic_id' }
    )
}

// 글감 일일 노출 수 확인 (하루 20개 제한)
export async function getTodaySeenCount(userId: string): Promise<number> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('user_seen_topics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('seen_at', new Date().toISOString().slice(0, 10)) // 오늘 날짜 이후

  return count ?? 0
}
