'use client'

import { useState, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fetchTopicCards, fetchWrittenDates } from './actions/main'
import type { TopicCard } from './actions/main'

type Props = {
  userId: string
  initialCards: TopicCard[]
  writtenDates: string[]
}

const NUDGE_THRESHOLD = 5 // 몇 번 넘기면 넛지 표시

export default function MainClient({ userId, initialCards, writtenDates }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<TopicCard[]>(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [calOpen, setCalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dates, setDates] = useState<string[]>(writtenDates)
  const [isPending, startTransition] = useTransition()

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const writtenSet = new Set(dates)

  // 넛지: NUDGE_THRESHOLD 이상 넘겼는지
  const showNudge = currentIndex >= NUDGE_THRESHOLD

  // 다음 카드 — 뒤에 3개 미만 남으면 추가 로드
  const handleNext = useCallback(() => {
    const next = currentIndex + 1
    setCurrentIndex(next)

    if (cards.length - next <= 3) {
      startTransition(async () => {
        const more = await fetchTopicCards(userId, 10)
        setCards((prev) => [...prev, ...more])
      })
    }
  }, [currentIndex, cards.length, userId])

  // 이전 카드
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  // 카드 클릭 → 에디터
  const handleCardClick = (card: TopicCard) => {
    router.push(`/editor?topicId=${card.id}`)
  }

  // 편하게 써볼게요 (넛지 버튼) → 현재 카드로 에디터
  const handleNudgeWrite = () => {
    const card = cards[currentIndex]
    if (card) router.push(`/editor?topicId=${card.id}`)
  }

  // 자유 주제
  const handleFreeWrite = () => {
    router.push('/editor?free=true')
  }

  // 캘린더 날짜 새로고침 (홈 복귀 후)
  const refreshDates = useCallback(async () => {
    const supabase = (await import('./actions/main')).fetchWrittenDates
    const fresh = await supabase(userId)
    setDates(fresh)
  }, [userId])

  const currentCard = cards[currentIndex]

  return (
    <>
      {/* 사이드바 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: '59px', paddingBottom: '34px' }}
      >
        <div className="px-6 pb-5 border-b border-zinc-100">
          <span className="text-base font-medium tracking-tight">spark</span>
        </div>
        <nav className="flex flex-col px-4 py-4 gap-1">
          <SidebarItem label="✦  글감 홈" active onClick={() => setSidebarOpen(false)} />
          <SidebarItem
            label="☰  내 글"
            onClick={() => { setSidebarOpen(false); router.push('/archive') }}
          />
          <SidebarItem
            label="⊙  설정"
            onClick={() => { setSidebarOpen(false); router.push('/settings') }}
          />
        </nav>
        <div className="mx-4 border-t border-zinc-100 my-1" />
        <nav className="flex flex-col px-4 gap-1">
          <SidebarItem
            label="카테고리 편집"
            small
            onClick={() => { setSidebarOpen(false); router.push('/onboarding?edit=true') }}
          />
        </nav>
      </aside>

      {/* 메인 */}
      <main
        className="min-h-screen bg-white flex flex-col"
        style={{ paddingTop: '59px', paddingBottom: '34px', maxWidth: '390px', margin: '0 auto' }}
      >
        {/* 헤더 */}
        <header className="px-5 pt-6 pb-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col gap-[5px] p-1"
            aria-label="메뉴 열기"
          >
            <span className="block w-[18px] h-[1.5px] bg-zinc-800" />
            <span className="block w-[14px] h-[1.5px] bg-zinc-800" />
            <span className="block w-[18px] h-[1.5px] bg-zinc-800" />
          </button>
          <span className="text-base font-medium tracking-tight">spark</span>
          <div className="w-7" />
        </header>

        {/* 캘린더 */}
        <section className="px-5 mb-5">
          <CalendarSection
            today={today}
            todayStr={todayStr}
            writtenSet={writtenSet}
            calOpen={calOpen}
            onToggle={() => setCalOpen((v) => !v)}
            writtenCount={dates.length}
          />
        </section>

        <div className="mx-5 border-t border-zinc-100 mb-6" />

        {/* 글감 슬라이드 영역 */}
        <section className="flex-1 flex flex-col">

          {/* 섹션 타이틀 + 카드 인덱스 */}
          <div className="px-5 flex items-center justify-between mb-3">
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
              오늘의 글감
            </span>
            <span className="text-[10px] text-zinc-300">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>

          {/* 카드 슬라이드 */}
          <div className="px-5 relative">
            {cards.length === 0 ? (
              <EmptyTopics />
            ) : (
              <div className="relative">
                {/* 현재 카드 */}
                {currentCard && (
                  <TopicCardItem
                    card={currentCard}
                    onClick={() => handleCardClick(currentCard)}
                  />
                )}

                {/* 다음 카드 미리보기 (오른쪽 살짝) */}
                {cards[currentIndex + 1] && (
                  <div
                    className="absolute top-3 -right-3 w-12 rounded-2xl border border-zinc-100 bg-white opacity-60"
                    style={{ height: '80%' }}
                  />
                )}

                {/* 네비게이션 버튼 */}
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1 text-[11px] text-zinc-400
                      hover:text-zinc-700 disabled:opacity-20 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M19 12H5M5 12L11 6M5 12L11 18" />
                    </svg>
                    이전
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={isPending}
                    className="flex items-center gap-1 text-[11px] text-zinc-400
                      hover:text-zinc-700 disabled:opacity-40 transition-colors"
                  >
                    다음
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M5 12H19M19 12L13 6M19 12L13 18" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 넛지 — 5개 이상 넘겼을 때 */}
          {showNudge && (
            <div className="px-5 mt-5 flex flex-col items-center gap-3">
              <p className="text-[12px] text-zinc-400">그냥 써도 괜찮아요</p>
              <button
                onClick={handleNudgeWrite}
                className="px-5 py-2.5 bg-zinc-900 text-white rounded-full text-[12px] font-medium
                  hover:bg-zinc-700 transition-colors active:scale-95"
              >
                편하게 써볼게요
              </button>
            </div>
          )}

          {/* 자유 주제 — 항상 하단 노출 */}
          <div className="px-5 mt-5">
            <button
              onClick={handleFreeWrite}
              className="w-full text-center text-[12px] text-zinc-400
                hover:text-zinc-600 transition-colors py-2
                border-t border-dashed border-zinc-100"
            >
              그냥 쓰고 싶어요
            </button>
          </div>

        </section>
      </main>
    </>
  )
}

// ── 캘린더 섹션 ───────────────────────────────────────────────
function CalendarSection({
  today, todayStr, writtenSet, calOpen, onToggle, writtenCount,
}: {
  today: Date
  todayStr: string
  writtenSet: Set<string>
  calOpen: boolean
  onToggle: () => void
  writtenCount: number
}) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const todayDate = today.getDate()
  const todayDow = today.getDay()
  const weekStart = todayDate - todayDow
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']

  const toDateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const renderDot = (d: number | null, key: string) => {
    if (d === null || d < 1 || d > lastDate) return <div key={key} className="aspect-square" />
    const ds = toDateStr(d)
    const isToday = ds === todayStr
    const written = writtenSet.has(ds)
    const isPast = ds < todayStr

    return (
      <div key={key} className="aspect-square flex items-center justify-center">
        <div className={[
          'w-7 h-7 rounded-full flex items-center justify-center text-[10px]',
          isToday  ? 'border-[1.5px] border-zinc-900 text-zinc-900 font-semibold'
          : written ? 'bg-zinc-900 text-white font-medium'
          : isPast  ? 'border border-zinc-200 text-zinc-300'
                    : 'border border-zinc-100 text-zinc-300',
        ].join(' ')}>
          {d}
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-zinc-900">
          {month + 1}월
          <span className="text-zinc-400 font-normal ml-2 text-[11px]">
            {writtenCount}편 작성
          </span>
        </span>
        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
          {calOpen ? '접기' : '전체 보기'}
          <span
            className="inline-block transition-transform duration-300"
            style={{ transform: calOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >▾</span>
        </span>
      </button>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[9px] text-zinc-400 pb-1">{d}</div>
        ))}
      </div>

      {/* 접힌 상태: 오늘 포함 주 */}
      {!calOpen && (
        <div className="grid grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => {
            const d = weekStart + i
            return renderDot(d >= 1 && d <= lastDate ? d : null, `w${i}`)
          })}
        </div>
      )}

      {/* 펼친 상태: 전체 월 */}
      {calOpen && (
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDow }, (_, i) => renderDot(null, `e${i}`))}
          {Array.from({ length: lastDate }, (_, i) => renderDot(i + 1, `d${i + 1}`))}
        </div>
      )}
    </div>
  )
}

// ── 글감 카드 ─────────────────────────────────────────────────
function TopicCardItem({ card, onClick }: { card: TopicCard; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-zinc-100 bg-white px-6 py-6
        hover:border-zinc-300 hover:shadow-sm active:scale-[0.99]
        transition-all duration-150"
    >
      <p className="text-[9px] text-zinc-400 uppercase tracking-widest mb-3">
        {card.category}
      </p>
      <p className="text-[16px] font-medium text-zinc-900 leading-snug">
        {card.content}
      </p>
      <p className="text-[11px] text-zinc-300 mt-4 text-right">탭해서 쓰기 →</p>
    </button>
  )
}

// ── 빈 상태 ───────────────────────────────────────────────────
function EmptyTopics() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[13px] text-zinc-400 leading-relaxed">
        모든 글감을 다 봤어요.<br />
        처음부터 다시 볼까요?
      </p>
    </div>
  )
}

// ── 사이드바 아이템 ───────────────────────────────────────────
function SidebarItem({
  label, active, small, onClick,
}: {
  label: string; active?: boolean; small?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2 rounded-xl transition-colors',
        small ? 'text-[12px]' : 'text-[14px]',
        active
          ? 'bg-zinc-100 text-zinc-900 font-medium'
          : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
