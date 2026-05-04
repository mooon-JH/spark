import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchTopicCards, fetchWrittenDates } from './actions/main'
import MainClient from './MainClient'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [cards, writtenDates] = await Promise.all([
    fetchTopicCards(user.id),
    fetchWrittenDates(user.id),
  ])

  return (
    <MainClient
      userId={user.id}
      initialCards={cards}
      writtenDates={writtenDates}
    />
  )
}
