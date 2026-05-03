'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveOnboardingCategories } from '@/app/actions/onboarding'

const CATEGORIES = [
  { id: '커리어',       emoji: '💼' },
  { id: '창업',         emoji: '🚀' },
  { id: '비즈니스인사이트', emoji: '📊' },
  { id: '기획',         emoji: '🗂️' },
  { id: '경험',         emoji: '🏔️' },
  { id: '감정',         emoji: '💭' },
  { id: '크리에이티브', emoji: '🎨' },
  { id: '예술',         emoji: '🖼️' },
  { id: '취향',         emoji: '☕' },
  { id: '컬쳐',         emoji: '🌐' },
  { id: '테크&트렌드',  emoji: '⚡' },
  { id: '철학',         emoji: '🌿' },
  { id: '인간관계',     emoji: '🤝' },
  { id: '루틴',         emoji: '⏰' },
  { id: '라이프스타일', emoji: '🌅' },
  { id: '웰니스',       emoji: '🧘' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const MIN = 3

export default function OnboardingPage() {
  const router = useRouter()
  const [shuffled, setShuffled] = useState([...CATEGORIES])

  // 서버/클라이언트 순서 불일치 방지 — 클라이언트에서만 셔플
  useEffect(() => {
    setShuffled(shuffle([...CATEGORIES]))
  }, [])
  const [selected, setSelected] = useState<Map<CategoryId, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: CategoryId) {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.set(id, next.size + 1)
      }
      return next
    })
  }

  async function handleStart() {
    if (selected.size < MIN || loading) return
    setLoading(true)
    setError(null)
    try {
      const categories = Array.from(selected.entries()).map(([category, click_order]) => ({
        category,
        click_order,
      }))
      await saveOnboardingCategories(categories)
      router.push('/')
    } catch {
      setError('저장에 실패했어요. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  const n = selected.size
  const isReady = n >= MIN
  const hintText =
    n === 0 ? '3개 이상 선택해주세요' :
    n < MIN  ? `${MIN - n}개 더 선택해주세요` :
               `✦ ${n}개 선택됨`

  return (
    // 바깥: 전체 화면 중앙 정렬 + 배경
    <div className="min-h-screen bg-white flex justify-center">
      {/* 안쪽: 모바일 최대 너비 390px 고정 */}
      <div className="flex flex-col w-full max-w-[390px] h-screen overflow-hidden relative">

      {/* 상단 브랜드 */}
      <div className="flex-shrink-0 px-6" style={{ paddingTop: 59 }}>
        <p className="text-[13px] font-normal text-black">spark</p>
        <p className="text-[11px] text-gray-400 mt-0.5">생각이 글이 되는 순간</p>
      </div>

      {/* 히어로 + 그리드 */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="w-full px-5 text-center">

          <svg className="w-[22px] h-[22px] mx-auto mb-3.5" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L13.8 9.2L21 12L13.8 14.8L12 22L10.2 14.8L3 12L10.2 9.2Z" fill="black" />
          </svg>

          <p className="text-[26px] font-medium text-black tracking-tight leading-tight mb-0.5">
            어떤 주제로
          </p>
          <p className="text-[26px] font-normal text-gray-400 tracking-tight leading-tight mb-5">
            글을 쓰고 싶나요?
          </p>

          <div className="grid grid-cols-4 gap-1.5">
            {shuffled.map((cat, i) => {
              const isOn = selected.has(cat.id)
              const delay = `${(i % 4) * 0.4 + Math.floor(i / 4) * 0.15}s`
              return (
                <button
                  key={cat.id}
                  onClick={() => toggle(cat.id)}
                  style={{ animationDelay: isOn ? undefined : delay }}
                  className={[
                    'flex flex-col items-center justify-center gap-0.5',
                    'py-2 px-1 rounded-[10px] min-h-[44px] border',
                    'text-[10px] leading-tight text-center transition-colors duration-150',
                    'active:scale-95',
                    isOn
                      ? 'bg-black border-black text-white'
                      : 'bg-white border-gray-200 text-black animate-float',
                  ].join(' ')}
                >
                  <span className="text-[15px] leading-none">{cat.emoji}</span>
                  <span className="break-keep">{cat.id}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col items-center gap-2 mt-[18px]">
            <p className={`text-[11px] transition-colors duration-200 ${isReady ? 'text-black' : 'text-gray-400'}`}>
              {hintText}
            </p>
            <button
              onClick={handleStart}
              disabled={!isReady || loading}
              className={[
                'w-[52px] h-[52px] rounded-full flex items-center justify-center',
                'transition-all duration-200 outline-none',
                isReady && !loading
                  ? 'bg-black border-transparent active:scale-95'
                  : 'bg-transparent border border-gray-300',
              ].join(' ')}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12H19M19 12L13 6M19 12L13 18"
                  stroke={isReady && !loading ? 'white' : '#9CA3AF'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
        </div>
      </div>

      {/* 하단 Safe Area */}
      <div className="flex-shrink-0" style={{ height: 34 }} />
      </div>
    </div>
  )
}
