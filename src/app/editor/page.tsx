import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDraft } from '../actions/editor'
import EditorClient from './EditorClient'
import { Suspense } from 'react'

type SearchParams = Promise<{
  topicId?: string
  free?: string
}>

// 데이터 로딩 — 병렬로 처리
async function EditorData({
  topicId,
  isFree,
  userId,
}: {
  topicId: string | null
  isFree: boolean
  userId: string
}) {
  const supabase = await createClient()

  // topics 조회 + draft 조회를 병렬로
  const [topicResult, draft] = await Promise.all([
    topicId
      ? supabase.from('topics').select('content').eq('id', topicId).single()
      : Promise.resolve({ data: null }),
    getDraft({ userId, topicId }),
  ])

  const topicContent =
    draft?.topic_content ?? topicResult.data?.content ?? ''

  return (
    <EditorClient
      userId={userId}
      topicId={topicId}
      topicContent={topicContent}
      isFree={isFree}
      draft={draft}
    />
  )
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { topicId, free } = await searchParams
  const isFree = free === 'true'

  if (!isFree && !topicId) redirect('/')

  return (
    // Suspense로 감싸서 데이터 로딩 중에도 즉시 렌더링
    // 비유: 빈 그릇 먼저 테이블에 올리고, 음식은 바로 뒤따라 나오는 것
    <Suspense fallback={<EditorSkeleton />}>
      <EditorData
        topicId={topicId ?? null}
        isFree={isFree}
        userId={user.id}
      />
    </Suspense>
  )
}

// 로딩 중 스켈레톤 — 에디터 레이아웃과 동일한 구조
function EditorSkeleton() {
  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ paddingTop: '59px', paddingBottom: '34px', maxWidth: '390px', margin: '0 auto' }}
    >
      {/* 헤더 */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-zinc-50">
        <div className="w-6 h-4 bg-zinc-100 rounded animate-pulse" />
        <div className="w-16 h-3 bg-zinc-100 rounded animate-pulse" />
      </header>

      {/* 글감 스켈레톤 */}
      <div className="px-5 mt-6 mb-5 space-y-2">
        <div className="w-3/4 h-5 bg-zinc-100 rounded animate-pulse" />
        <div className="w-1/2 h-5 bg-zinc-100 rounded animate-pulse" />
      </div>

      <div className="mx-5 border-t border-zinc-100 mb-5" />

      {/* 입력창 스켈레톤 */}
      <div className="px-5 space-y-3">
        <div className="w-full h-4 bg-zinc-50 rounded animate-pulse" />
        <div className="w-4/5 h-4 bg-zinc-50 rounded animate-pulse" />
        <div className="w-3/5 h-4 bg-zinc-50 rounded animate-pulse" />
      </div>
    </div>
  )
}
