import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDraft } from '../actions/editor'
import EditorClient from './EditorClient'

type SearchParams = Promise<{
  topicId?: string
  firstSentence?: string
  free?: string
}>

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

  const { topicId, firstSentence, free } = await searchParams
  const isFree = free === 'true'

  // 글감 에디터: topicId 필수
  if (!isFree && !topicId) redirect('/')

  let topicContent = ''

  if (topicId) {
    const { data: topic } = await supabase
      .from('topics')
      .select('content')
      .eq('id', topicId)
      .single()

    if (!topic) redirect('/')
    topicContent = topic.content
  }

  const draft = await getDraft({
    userId: user.id,
    topicId: topicId ?? null,
  })

  return (
    <EditorClient
      userId={user.id}
      topicId={topicId ?? null}
      topicContent={draft?.topic_content ?? topicContent}
      firstSentence={decodeURIComponent(firstSentence ?? '')}
      isFree={isFree}
      draft={draft}
    />
  )
}
