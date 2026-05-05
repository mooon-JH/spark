'use server'

import { createClient } from '@/lib/supabase/server'

export type TopicCard = {
  id: string
  content: string
  category: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 글감 N개 뽑기 (가로 슬라이드용 — 초기 로드 및 추가 로드 공용)
// 비유: 카드 덱에서 아직 안 본 카드를 셔플해서 꺼내는 것
export async function fetchTopicCards(
  userId: string,
  count: number = 10
): Promise<TopicCard[]> {
  const supabase = await createClient()

  const { data: userCats } = await supabase
    .from('user_categories')
    .select('category')
    .eq('user_id', userId)
    .eq('is_removed', false)

  if (!userCats?.length) return []

  const { data: seen } = await supabase
    .from('user_seen_topics')
    .select('topic_id')
    .eq('user_id', userId)

  const seenIds = new Set(seen?.map((s) => s.topic_id) ?? [])
  const categories = shuffle(userCats.map((c) => c.category))
  const cards: TopicCard[] = []
  const usedInRound = new Set<string>()

  // 라운드 로빈 방식으로 카테고리 순환하며 count개 채우기
  let rounds = 0
  while (cards.length < count && rounds < count * 2) {
    rounds++
    for (const category of categories) {
      if (cards.length >= count) break

      const { data: topicIds } = await supabase
        .from('topic_categories')
        .select('topic_id')
        .eq('category', category)

      if (!topicIds?.length) continue

      const available = topicIds
        .map((t) => t.topic_id)
        .filter((id) => !seenIds.has(id) && !usedInRound.has(id))

      if (!available.length) continue

      const randomId = available[Math.floor(Math.random() * available.length)]

      const { data: topic } = await supabase
        .from('topics')
        .select('id, content')
        .eq('id', randomId)
        .single()

      if (!topic) continue

      cards.push({ id: topic.id, content: topic.content, category })
      usedInRound.add(randomId)
    }
    if (cards.length < count) usedInRound.clear()
  }

  return cards
}

// 이번 달 글 쓴 날짜 목록 (캘린더용)
export async function fetchWrittenDates(userId: string): Promise<string[]> {
  const supabase = await createClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastDay = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  ).toISOString()

  const { data } = await supabase
    .from('writings')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', firstDay)
    .lte('created_at', lastDay)

  if (!data) return []

  const dates = new Set(data.map((w) => w.created_at.slice(0, 10)))
  return Array.from(dates)
}
