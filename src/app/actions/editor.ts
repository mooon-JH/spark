'use server'

import { createClient } from '@/lib/supabase/server'

export type WritingDraft = {
  id: string
  topic_id: string | null
  topic_content: string
  first_sentence: string
  body: string
}

// 글 저장 (upsert)
// 비유: writingId 있으면 기존 문서 덮어쓰기, 없으면 새 문서 생성
export async function saveWriting({
  writingId,
  userId,
  topicId,
  topicContent,
  firstSentence,
  body,
}: {
  writingId: string | null
  userId: string
  topicId: string | null
  topicContent: string
  firstSentence: string
  body: string
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()

  if (writingId) {
    const { error } = await supabase
      .from('writings')
      .update({
        body,
        topic_content: topicContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', writingId)
      .eq('user_id', userId)

    if (error) return { error: error.message }
    return { id: writingId }
  }

  const { data, error } = await supabase
    .from('writings')
    .insert({
      user_id: userId,
      topic_id: topicId,
      topic_content: topicContent,
      first_sentence: firstSentence,
      body,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // 글감을 "본 목록"에 추가 (자유 주제는 스킵)
  if (topicId) {
    await supabase
      .from('user_seen_topics')
      .upsert(
        { user_id: userId, topic_id: topicId },
        { onConflict: 'user_id,topic_id' }
      )
  }

  return { id: data.id }
}

// 동일 topic_id로 작성 중인 임시저장 글 조회
export async function getDraft({
  userId,
  topicId,
}: {
  userId: string
  topicId: string | null
}): Promise<WritingDraft | null> {
  const supabase = await createClient()

  const query = supabase
    .from('writings')
    .select('id, topic_id, topic_content, first_sentence, body')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (topicId) {
    query.eq('topic_id', topicId)
  } else {
    query.is('topic_id', null)
  }

  const { data } = await query.single()
  return data ?? null
}
