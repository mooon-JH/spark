import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDraft } from '../actions/editor'
import EditorClient from './EditorClient'
import { Suspense } from 'react'

type SearchParams = Promise<{
  topicId?: string
  free?: string
  from?: string      // 'archive'면 아카이브로 복귀
  writingId?: string // 기존 글 수정 시
  newDoc?: string    // 홈에서 새 글로 진입 시 (getDraft 생략용)
  initialBody?: string // 홈 입력창에서 넘어온 초기 텍스트
}>

async function EditorData({
  topicId,
  isFree,
  userId,
  returnTo,
  existingWritingId,
  isNewDoc,
  initialBody,
}: {
  topicId: string | null
  isFree: boolean
  userId: string
  returnTo: 'home' | 'archive'
  existingWritingId: string | null
  isNewDoc: boolean
  initialBody: string
}) {
  const supabase = await createClient()

  const [topicResult, draft] = await Promise.all([
    topicId
      ? supabase.from('topics').select('content').eq('id', topicId).single()
      : Promise.resolve({ data: null }),
    // 기존 글 수정이면 writingId로 조회
    // 새 글(newDoc)이면 getDraft 생략 → 불필요한 서버 fetch 제거 (item 5b)
    // 아니면 topicId로 이어쓰던 draft 조회
    existingWritingId
      ? supabase
          .from('writings')
          .select('id, topic_id, topic_content, body')
          .eq('id', existingWritingId)
          .eq('user_id', userId)
          .single()
          .then((r) => r.data ?? null)
      : isNewDoc
        ? Promise.resolve(null)
        : getDraft({ userId, topicId }),
  ])

  const topicContent =
    (draft as { topic_content?: string } | null)?.topic_content ??
    topicResult.data?.content ??
    ''

  return (
    <EditorClient
      userId={userId}
      topicId={topicId}
      topicContent={topicContent}
      isFree={isFree}
      draft={draft as Parameters<typeof EditorClient>[0]['draft']}
      returnTo={returnTo}
      initialBody={initialBody}
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

  const { topicId, free, from, writingId, newDoc, initialBody } = await searchParams
  const isFree = free === 'true'
  const returnTo: 'home' | 'archive' = from === 'archive' ? 'archive' : 'home'
  const isNewDoc = newDoc === 'true'

  if (!isFree && !topicId && !writingId) redirect('/')

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorData
        topicId={topicId ?? null}
        isFree={isFree}
        userId={user.id}
        returnTo={returnTo}
        existingWritingId={writingId ?? null}
        isNewDoc={isNewDoc}
        initialBody={initialBody ?? ''}
      />
    </Suspense>
  )
}

function EditorSkeleton() {
  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ maxWidth: '390px', margin: '0 auto' }}
    >
      <header className="px-5 pt-12 pb-4 flex items-center justify-between border-b border-zinc-50">
        <div className="w-6 h-4 bg-zinc-100 rounded animate-pulse" />
        <div className="w-16 h-3 bg-zinc-100 rounded animate-pulse" />
      </header>
      <div className="px-5 mt-6 mb-5 space-y-2">
        <div className="w-3/4 h-5 bg-zinc-100 rounded animate-pulse" />
        <div className="w-1/2 h-5 bg-zinc-100 rounded animate-pulse" />
      </div>
      <div className="px-5 space-y-3 mt-4">
        <div className="w-full h-4 bg-zinc-50 rounded animate-pulse" />
        <div className="w-4/5 h-4 bg-zinc-50 rounded animate-pulse" />
        <div className="w-3/5 h-4 bg-zinc-50 rounded animate-pulse" />
      </div>
    </div>
  )
}
