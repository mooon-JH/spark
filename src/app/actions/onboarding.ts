'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface CategoryInput {
  category: string
  click_order: number
}

export async function saveOnboardingCategories(categories: CategoryInput[]) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // 기존 데이터 삭제 (재설정 대비)
  await supabase.from('user_categories').delete().eq('user_id', user.id)

  const rows = categories.map(({ category, click_order }) => ({
    user_id: user.id,
    category,
    click_order,
    is_removed: false,
    selected_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase.from('user_categories').insert(rows)
  if (insertError) throw new Error(insertError.message)

  const { error: updateError } = await supabase
    .from('users')
    .update({ onboarding_completed: true })
    .eq('id', user.id)
  if (updateError) throw new Error(updateError.message)
}
