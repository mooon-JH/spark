import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchArchiveProfile, fetchWritings } from '../actions/archive'
import ArchiveClient from './ArchiveClient'

export default async function ArchivePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 프로필 + 글 목록 병렬 로드
  const [profile, writings] = await Promise.all([
    fetchArchiveProfile(user.id),
    fetchWritings(user.id),
  ])

  return (
    <ArchiveClient
      userId={user.id}
      profile={profile}
      writings={writings}
    />
  )
}
