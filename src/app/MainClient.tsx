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

export default function MainClient({ userId, nickname, initialCards }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<TopicCard[]>(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hasNavigated = useRef(false)

  const currentCard = cards[currentIndex]
  const hasMovedForward = currentIndex > 0

  // 다음 글감
  const handleNext = useCallback(() => {
    const next = currentIndex + 1

    // 20개 제한 체크
    if (next >= 20) {
      setExhausted(true)
      return
    }

    setCurrentIndex(next)

    // 뒤에 3개 미만 남으면 추가 로드
    if (cards.length - next <= 3) {
      startTransition(async () => {
        const more = await fetchTopicCards(userId, 10)
        if (more.length === 0) {
          setExhausted(true)
          return
        }
        setCards((prev) => [...prev, ...more])
      })
    }
  }, [currentIndex, cards.length, userId])

  // 이전 글감
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  // 좋아요 / 싫어요
  const handleFeedback = async (feedback: 'like' | 'dislike') => {
    if (!currentCard) return
    await recordTopicFeedback(userId, currentCard.id, feedback)
    // 싫어요면 다음으로 자동 이동
    if (feedback === 'dislike') handleNext()
  }

  // 입력창 첫 글자 → 에디터로 이동
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length > 0 && !hasNavigated.current) {
      hasNavigated.current = true
      const topicId = currentCard?.id
      if (topicId) {
        router.push(`/editor?topicId=${topicId}&initialBody=${encodeURIComponent(value)}`)
      } else {
        router.push(`/editor?free=true&initialBody=${encodeURIComponent(value)}`)
      }
    }
  }

  // 자유 주제
  const handleFreeWrite = () => {
    router.push('/editor?free=true')
  }

  // 아카이브
  const handleArchive = () => {
    router.push('/archive')
  }

  if (exhausted) {
    return <ExhaustedView onFreeWrite={handleFreeWrite} />
  }

  return (
    <main
      className="min-h-screen bg-white flex flex-col"
      style={{ maxWidth: '390px', margin: '0 auto', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 헤더 */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between">
        <span className="text-[15px] text-zinc-800">
          {nickname}님, 안녕하세요
        </span>
        <button
          onClick={handleArchive}
          aria-label="아카이브"
          className="p-1 text-zinc-400 hover:text-zinc-800 transition-colors"
        >
          {/* 책 아이콘 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </button>
      </header>

      {/* 글감 영역 */}
      <section className="px-5 flex-1 flex flex-col justify-center" style={{ marginTop: '12px' }}>

        {cards.length === 0 ? (
          <ExhaustedView onFreeWrite={handleFreeWrite} />
        ) : (
          <>
            {/* 글감 카드 + 좌우 화살표 */}
            <div className="flex items-center gap-3 mb-4">
              {/* 왼쪽 화살표 — 첫 번째 글감이면 숨김 */}
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                aria-label="이전 글감"
                className="flex-shrink-0 text-zinc-300 hover:text-zinc-600 disabled:opacity-0
                  transition-colors"
                style={{ visibility: hasMovedForward ? 'visible' : 'hidden' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M15 18L9 12L15 6" />
                </svg>
              </button>

              {/* 글감 텍스트 */}
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
                className="flex-shrink-0 text-zinc-300 hover:text-zinc-600
                  disabled:opacity-40 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M9 18L15 12L9 6" />
                </svg>
              </button>
            </div>

            {/* 좋아요 / 싫어요 */}
            <div className="flex justify-center gap-6 mb-8">
              <button
                onClick={() => handleFeedback('like')}
                aria-label="좋아요"
                className="text-[18px] opacity-40 hover:opacity-100 transition-opacity active:scale-110"
              >
                👍
              </button>
              <button
                onClick={() => handleFeedback('dislike')}
                aria-label="싫어요"
                className="text-[18px] opacity-40 hover:opacity-100 transition-opacity active:scale-110"
              >
                👎
              </button>
            </div>

            {/* 입력창 — pulse 애니메이션 */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="떠오르는 장면부터 써봐요..."
                className="w-full px-4 py-4 rounded-2xl border border-zinc-100 bg-white
                  text-[15px] text-zinc-800 placeholder:text-zinc-300
                  outline-none focus:border-zinc-300 transition-colors
                  animate-pulse-border"
                style={{
                  boxShadow: '0 0 0 0 rgba(0,0,0,0)',
                  animation: 'pulseBorder 2.5s ease-in-out infinite',
                }}
              />
            </div>
          </>
        )}

        {/* 자유롭게 써볼게요 */}
        <div className="mt-6 text-center">
          <button
            onClick={handleFreeWrite}
            className="text-[13px] text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            자유롭게 써볼게요
          </button>
        </div>

      </section>

      {/* pulse 애니메이션 스타일 */}
      <style>{`
        @keyframes pulseBorder {
          0%, 100% { border-color: rgb(244 244 245); box-shadow: 0 0 0 0 rgba(161,161,170,0); }
          50% { border-color: rgb(212 212 216); box-shadow: 0 0 0 4px rgba(161,161,170,0.08); }
        }
      `}</style>
    </main>
  )
}

// ── 글감 소진 뷰 ──────────────────────────────────────────────
function ExhaustedView({ onFreeWrite }: { onFreeWrite: () => void }) {
  return (
    <main
      className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center"
      style={{ maxWidth: '390px', margin: '0 auto' }}
    >
      <p className="text-[15px] text-zinc-500 leading-relaxed mb-1">
        오늘의 글감을 모두 봤어요.
      </p>
      <p className="text-[13px] text-zinc-400 mb-8">
        내일 새로운 글감이 기다리고 있어요.
      </p>
      <button
        onClick={onFreeWrite}
        className="text-[13px] text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        자유롭게 써볼게요
      </button>
    </main>
  )
}
