'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fetchTopicCards } from './actions/main'
import type { TopicCard } from './actions/main'

type Props = {
  userId: string
  initialCards: TopicCard[]
  writtenDates: string[]
}

type FirstSentenceState = {
  topicId: string
  sentences: string[]
  streaming: boolean
}

export default function MainClient({ userId, initialCards, writtenDates }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<TopicCard[]>(initialCards)
  const [isPending, startTransition] = useTransition()
  const [calOpen, setCalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [firstSentenceState, setFirstSentenceState] = useState<FirstSentenceState | null>(null)

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const writtenSet = new Set(writtenDates)

  // 새로고침
  const handleRefresh = () => {
    setFirstSentenceState(null)
    startTransition(async () => {
      const next = await fetchTopicCards(userId)
      setCards(next)
    })
  }

  // 카드 클릭 → 첫 문장 스트리밍 요청
  const handleCardClick = async (card: TopicCard) => {
    // 이미 이 카드의 첫 문장이 로드됐으면 바로 에디터로
    if (firstSentenceState?.topicId === card.id && firstSentenceState.sentences.length > 0) {
      const sentence = firstSentenceState.sentences[0]
      router.push(`/editor?topicId=${card.id}&firstSentence=${encodeURIComponent(sentence)}`)
      return
    }

    // 첫 문장 요청 (로딩 표시)
    setFirstSentenceState({ topicId: card.id, sentences: [], streaming: true })

    try {
      const res = await fetch('/api/first-sentences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContent: card.content }),
      })

      const text = await res.text()
      const sentences: string[] = JSON.parse(text)

      setFirstSentenceState({ topicId: card.id, sentences, streaming: false })

      router.push(
        `/editor?topicId=${card.id}&firstSentence=${encodeURIComponent(sentences[0] ?? '')}`
      )
    } catch (e) {
      console.error('first-sentences 실패:', e)
      setFirstSentenceState(null)
      router.push(`/editor?topicId=${card.id}&firstSentence=`)
    }
  }

  // 자유 주제
  const handleFreeWrite = () => {
    router.push('/editor?free=true')
  }

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
        <div className="px-6 pb-6 border-b border-zinc-100">
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
        <div className="mx-4 border-t border-zinc-100 my-2" />
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
            writtenCount={writtenDates.length}
          />
        </section>

        <div className="mx-5 border-t border-zinc-100 mb-5" />

        {/* 글감 카드 */}
        <section className="px-5 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
              오늘의 글감
            </span>
            <button
              onClick={handleRefresh}
              disabled={isPending}
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-700
                transition-colors disabled:opacity-40"
            >
              <RefreshIcon spinning={isPending} />
              다른 글감
            </button>
          </div>

          {cards.length === 0 ? (
            <EmptyTopics />
          ) : (
            cards.map((card, i) => (
              <TopicCardItem
                key={card.id}
                card={card}
                index={i}
                loading={firstSentenceState?.topicId === card.id && firstSentenceState.streaming}
                dimmed={isPending}
                onClick={() => handleCardClick(card)}
              />
            ))
          )}

          {/* 자유 주제 */}
          <button
            onClick={handleFreeWrite}
            className="w-full flex items-center justify-center gap-2 mt-1
              border border-dashed border-zinc-200 rounded-2xl py-3
              text-[12px] text-zinc-400 hover:text-zinc-600 hover:border-zinc-300
              transition-colors"
          >
            <span className="text-[13px]">✎</span>
            자유 주제로 쓰기
          </button>
        </section>
      </main>
    </>
  )
}

// ── 캘린더 섹션 ───────────────────────────────────────────────
function CalendarSection({
  today,
  todayStr,
  writtenSet,
  calOpen,
  onToggle,
  writtenCount,
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
  const thisWeekDates = Array.from({ length: 7 }, (_, i) => weekStart + i)
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']

  const toDateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const renderDot = (d: number | null, key: string) => {
    if (d === null || d < 1 || d > lastDate) {
      return <div key={key} className="aspect-square" />
    }
    const ds = toDateStr(d)
    const isToday = ds === todayStr
    const written = writtenSet.has(ds)
    const isPast = ds < todayStr

    return (
      <div key={key} className="aspect-square flex items-center justify-center">
        <div
          className={[
            'w-7 h-7 rounded-full flex items-center justify-center text-[10px]',
            isToday
              ? 'border-[1.5px] border-zinc-900 text-zinc-900 font-semibold'
              : written
              ? 'bg-zinc-900 text-white font-medium'
              : isPast
              ? 'border border-zinc-200 text-zinc-300'
              : 'border border-zinc-100 text-zinc-300',
          ].join(' ')}
        >
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
          >
            ▾
          </span>
        </span>
      </button>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[9px] text-zinc-400 pb-1">{d}</div>
        ))}
      </div>

      {!calOpen && (
        <div className="grid grid-cols-7">
          {thisWeekDates.map((d, i) =>
            renderDot(d >= 1 && d <= lastDate ? d : null, `w${i}`)
          )}
        </div>
      )}

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
function TopicCardItem({
  card,
  index,
  loading,
  dimmed,
  onClick,
}: {
  card: TopicCard
  index: number
  loading: boolean
  dimmed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={dimmed || loading}
      className="w-full text-left rounded-2xl border border-zinc-100 bg-white px-5 py-4
        hover:border-zinc-300 hover:shadow-sm active:scale-[0.99]
        transition-all duration-200 disabled:opacity-60 relative"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <p className="text-[9px] text-zinc-400 uppercase tracking-widest mb-2">
        {card.category}
      </p>
      <p className="text-[14px] font-medium text-zinc-900 leading-snug">
        {card.content}
      </p>
      {loading ? (
        <p className="text-[11px] text-zinc-300 mt-3 border-t border-zinc-100 pt-3">
          첫 문장 생성 중...
        </p>
      ) : null}
      <span className="absolute right-4 bottom-3 text-[10px] text-zinc-300">→</span>
    </button>
  )
}

// ── 빈 상태 ───────────────────────────────────────────────────
function EmptyTopics() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[13px] text-zinc-400 leading-relaxed">
        모든 글감을 다 보셨어요.<br />
        카테고리를 편집하거나 잠시 후 다시 시도해주세요.
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

// ── 새로고침 아이콘 ───────────────────────────────────────────
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}
