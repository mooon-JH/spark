'use client'

import { useState, useRef, useCallback, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchTopicCards, recordTopicFeedback } from './actions/main'
import type { TopicCard } from './actions/main'

type Props = {
  userId: string
  nickname: string
  initialCards: TopicCard[]
}

type ExpandRect = { top: number; right: number; bottom: number; left: number }

export default function MainClient({ userId, nickname, initialCards }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<TopicCard[]>(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [inputValue, setInputValue] = useState('')
  const [mounted, setMounted] = useState(false)
  const hasNavigated = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 확장 전환 애니메이션
  const [expandState, setExpandState] = useState<'idle' | 'init' | 'open'>('idle')
  const [expandRect, setExpandRect] = useState<ExpandRect | null>(null)

  // 좋아요 시각 피드백
  const [likedCardId, setLikedCardId] = useState<string | null>(null)

  // 진입 페이드인
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  const currentCard = cards[currentIndex]
  const hasMovedForward = currentIndex > 0

  const handleNext = useCallback(() => {
    const next = currentIndex + 1
    if (next >= 20) { setExhausted(true); return }
    setCurrentIndex(next)
    if (cards.length - next <= 3) {
      startTransition(async () => {
        const more = await fetchTopicCards(userId, 10)
        if (more.length === 0) { setExhausted(true); return }
        setCards((prev) => [...prev, ...more])
      })
    }
  }, [currentIndex, cards.length, userId])

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  const handleFeedback = async (feedback: 'like' | 'dislike') => {
    if (!currentCard) return
    if (feedback === 'like') {
      setLikedCardId(currentCard.id)
      setTimeout(() => setLikedCardId(null), 800)
    }
    await recordTopicFeedback(userId, currentCard.id, feedback)
    if (feedback === 'dislike') handleNext()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length > 0 && !hasNavigated.current) {
      hasNavigated.current = true

      // 입력창 위치 캡처
      const el = inputRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight
        setExpandRect({
          top: rect.top,
          right: vw - rect.right,
          bottom: vh - rect.bottom,
          left: rect.left,
        })
      }

      // 이동할 URL
      const topicId = currentCard?.id
      const navigate = () => {
        if (topicId) {
          router.push(`/editor?topicId=${topicId}&initialBody=${encodeURIComponent(value)}`)
        } else {
          router.push(`/editor?free=true&initialBody=${encodeURIComponent(value)}`)
        }
      }

      // init → (rAF×2) → open → navigate
      setExpandState('init')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setExpandState('open')
          setTimeout(navigate, 320)
        })
      })
    }
  }

  const handleFreeWrite = () => router.push('/editor?free=true&newFree=true')
  const handleArchive = () => router.push('/archive')

  if (exhausted) return <ExhaustedView onFreeWrite={handleFreeWrite} />

  return (
    <main
      className="min-h-screen bg-white flex flex-col"
      style={{
        maxWidth: '390px',
        margin: '0 auto',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {/* 확장 전환 오버레이 — 입력창 위치에서 전체 화면으로 열림 */}
      {expandState !== 'idle' && expandRect && (
        <div
          className="fixed inset-0 bg-white z-50 pointer-events-none"
          style={{
            clipPath: expandState === 'init'
              ? `inset(${expandRect.top}px ${expandRect.right}px ${expandRect.bottom}px ${expandRect.left}px round 16px)`
              : 'inset(0px 0px 0px 0px round 0px)',
            transition: expandState === 'open'
              ? 'clip-path 0.38s cubic-bezier(0.4, 0, 0.2, 1)'
              : 'none',
          }}
        />
      )}
      {/* 헤더 */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between">
        <span className="text-[15px] text-zinc-800">{nickname}님, 안녕하세요</span>
        <button onClick={handleArchive} aria-label="아카이브" className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </button>
      </header>

      <section className="px-5 flex-1 flex flex-col justify-center" style={{ marginTop: '12px' }}>
        {cards.length === 0 ? (
          <ExhaustedView onFreeWrite={handleFreeWrite} />
        ) : (
          <>
            {/* 글감 + 좌우 화살표 */}
            <div className="flex items-center gap-4 mb-6">
              {/* 왼쪽 화살표 — 첫 진입 시 숨김 */}
              <button
                onClick={handlePrev}
                aria-label="이전 글감"
                className="flex-shrink-0"
                style={{ visibility: hasMovedForward ? 'visible' : 'hidden' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-700 hover:text-zinc-400 transition-colors active:scale-90">
                  <path d="M15 18L9 12L15 6" />
                </svg>
              </button>

              <div className="flex-1 text-center">
                <p className="text-[17px] font-medium text-zinc-900 leading-snug">
                  {currentCard?.content}
                </p>
              </div>

              {/* 오른쪽 화살표 */}
              <button
                onClick={handleNext}
                disabled={isPending}
                aria-label="다음 글감"
                className="flex-shrink-0 disabled:opacity-30"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-700 hover:text-zinc-400 transition-colors active:scale-90">
                  <path d="M9 18L15 12L9 6" />
                </svg>
              </button>
            </div>

            {/* 좋아요 / 싫어요 — SVG 미니멀 아이콘 */}
            <div className="flex justify-center gap-8 mb-8">
              <button
                onClick={() => handleFeedback('like')}
                aria-label="좋아요"
                className="group p-2"
              >
                <svg
                  width="18" height="18" viewBox="0 0 24 24"
                  fill={likedCardId === currentCard?.id ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    color: likedCardId === currentCard?.id ? '#71717a' : undefined,
                    transition: 'color 0.2s ease, fill 0.2s ease',
                  }}
                  className={likedCardId === currentCard?.id ? 'text-zinc-500' : 'text-zinc-300 group-hover:text-zinc-700 transition-colors'}
                >
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </button>
              <button onClick={() => handleFeedback('dislike')} aria-label="싫어요" className="group p-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 group-hover:text-zinc-700 transition-colors">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                  <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
              </button>
            </div>

            {/* 입력창 pulse */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="떠오르는 장면부터 써봐요..."
              className="w-full px-4 py-4 rounded-2xl border text-[15px] text-zinc-800 placeholder:text-zinc-300 outline-none"
              style={{ animation: 'pulseBorder 2.5s ease-in-out infinite' }}
            />
          </>
        )}

        <div className="mt-6 text-center">
          <button onClick={handleFreeWrite} className="text-[13px] text-zinc-400 hover:text-zinc-600 transition-colors">
            자유롭게 써볼게요
          </button>
        </div>
      </section>

      <style>{`
        @keyframes pulseBorder {
          0%, 100% { border-color: rgb(244 244 245); box-shadow: 0 0 0 0 rgba(161,161,170,0); }
          50% { border-color: rgb(212 212 216); box-shadow: 0 0 0 4px rgba(161,161,170,0.08); }
        }
      `}</style>
    </main>
  )
}

function ExhaustedView({ onFreeWrite }: { onFreeWrite: () => void }) {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center" style={{ maxWidth: '390px', margin: '0 auto' }}>
      <p className="text-[15px] text-zinc-500 leading-relaxed mb-1">오늘의 글감을 모두 봤어요.</p>
      <p className="text-[13px] text-zinc-400 mb-8">내일 새로운 글감이 기다리고 있어요.</p>
      <button onClick={onFreeWrite} className="text-[13px] text-zinc-400 hover:text-zinc-700 transition-colors">자유롭게 써볼게요</button>
    </main>
  )
}
