'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type WritingItem = {
  id: string
  body: string
  topic_content: string | null
  is_system: boolean
  created_at: string
}

export type ArchiveProfile = {
  nickname: string
  avatarUrl: string | null
  totalCount: number
  weekCount: number
  lastWrittenDaysAgo: number | null // null이면 오늘 씀
}

// 프로필 + 통계 조회
export async function fetchArchiveProfile(userId: string): Promise<ArchiveProfile> {
  const supabase = await createClient()

  const [profileResult, writingsResult] = await Promise.all([
    supabase.from('users').select('nickname').eq('id', userId).single(),
    supabase
      .from('writings')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const { data: { user } } = await supabase.auth.getUser()
  const avatarUrl = user?.user_metadata?.avatar_url ?? null
  const nickname = profileResult.data?.nickname ?? user?.user_metadata?.full_name ?? '익명'

  const writings = writingsResult.data ?? []
  const totalCount = writings.length

  // 이번 주 (월요일 기준) 작성 수
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const weekCount = writings.filter((w) => new Date(w.created_at) >= monday).length

  // 마지막 작성일 (오늘 쓴 경우 null)
  let lastWrittenDaysAgo: number | null = null
  if (writings.length > 0) {
    const lastDate = new Date(writings[0].created_at)
    lastDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    lastWrittenDaysAgo = diff === 0 ? null : diff
  }

  return { nickname, avatarUrl, totalCount, weekCount, lastWrittenDaysAgo }
}

// 글 목록 조회
export async function fetchWritings(userId: string): Promise<WritingItem[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('writings')
    .select('id, body, topic_content, is_system, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return data ?? []
}

// 닉네임 수정
export async function updateNickname(userId: string, nickname: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('users').update({ nickname }).eq('id', userId)
  revalidatePath('/archive')
}

// 글 삭제
export async function deleteWriting(userId: string, writingId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('writings')
    .delete()
    .eq('id', writingId)
    .eq('user_id', userId)
  revalidatePath('/archive')
}

// 로그아웃
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/')
}
