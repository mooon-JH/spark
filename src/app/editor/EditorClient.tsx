'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveWriting } from '../actions/editor'
import type { WritingDraft } from '../actions/editor'

type Props = {
  userId: string
  topicId: string | null
  topicContent: string
  isFree: boolean
  draft: WritingDraft | null
  returnTo?: 'home' | 'archive' // 복귀 분기
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function EditorClient({
  userId,
  topicId,
  topicContent: initialTopicContent,
  isFree,
  draft,
  returnTo = 'home',
}: Props) {
  const router = useRouter()

  // ── 기본 상태 ───────────────────────────────────────────────
  const [writingId, setWritingId]       = useState<string | null>(draft?.id ?? null)
  const [topicContent, setTopicContent] = useState(draft?.topic_content ?? initialTopicContent)
  const [body, setBody]                 = useState(draft?.body ?? '')
  const [saveStatus, setSaveStatus]     = useState<SaveStatus>('idle')
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [showAutoSaveTip, setShowAutoSaveTip] = useState(!draft?.body)

  // ── 이어쓰기 상태 ────────────────────────────────────────────
  const [suggestion, setSuggestion]     = useState<string>('')
  const [showSuggest, setShowSuggest]   = useState(false)
  const [showTooltip, setShowTooltip]   = useState(false)
  const tooltipShownRef                 = useRef(false) // 첫 등장 툴팁은 1회만
  const suggestTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownRef                     = useRef(false)
  const isAcceptingRef                  = useRef(false)

  // ── 피드백 상태 ──────────────────────────────────────────────
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState(false)
  const [sheetHeight, setSheetHeight]   = useState<40 | 80>(40) // %

  // ── refs ────────────────────────────────────────────────────
  const debounceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writingIdRef    = useRef<string | null>(writingId)
  const bodyRef         = useRef(body)
  const topicRef        = useRef(topicContent)
  const textareaRef     = useRef<HTMLTextAreaElement | null>(null)
  const bodyContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { writingIdRef.current = writingId }, [writingId])
  useEffect(() => { bodyRef.current = body },           [body])
  useEffect(() => { topicRef.current = topicContent },  [topicContent])

  // ── 자동 저장 (1.5초 디바운스) ──────────────────────────────
  const triggerSave = useCallback(async () => {
    if (!bodyRef.current.trim()) return
    setSaveStatus('saving')

    const result = await saveWriting({
      writingId: writingIdRef.current,
      userId,
      topicId,
      topicContent: topicRef.current,
      body: bodyRef.current,
    })

    if ('error' in result) {
      setSaveStatus('error')
    } else {
      setWritingId(result.id)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [userId, topicId])

  const scheduleAutosave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(triggerSave, 1500)
  }, [triggerSave])

  // 언마운트 시 즉시 저장
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (bodyRef.current.trim()) triggerSave()
    }
  }, [triggerSave])

  // 자동저장 안내 3초 후 자동 소멸
  useEffect(() => {
    if (!showAutoSaveTip) return
    const t = setTimeout(() => setShowAutoSaveTip(false), 3000)
    return () => clearTimeout(t)
  }, [showAutoSaveTip])

  // textarea 높이 자동 조절
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  // ── 이어쓰기: 멈춤 감지 → API 호출 ─────────────────────────
  const fetchSuggestion = useCallback(async () => {
    if (cooldownRef.current || isAcceptingRef.current) return
    if (!bodyRef.current.trim()) return

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: bodyRef.current }),
      })
      if (!res.ok) return

      const { suggestion: text } = await res.json()
      if (!text) return

      setSuggestion(text)
      setShowSuggest(true)

      // 첫 등장 툴팁 (1회만)
      if (!tooltipShownRef.current) {
        tooltipShownRef.current = true
        setShowTooltip(true)
        setTimeout(() => setShowTooltip(false), 3000)
      }
    } catch {
      // 조용히 무시
    }
  }, [])

  const schedulesuggestion = useCallback(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(fetchSuggestion, 3500)
  }, [fetchSuggestion])

  const clearSuggestion = useCallback(() => {
    setShowSuggest(false)
    setSuggestion('')
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
  }, [])

  // ── 이어쓰기 수락 ────────────────────────────────────────────
  // 한 글자씩 타이핑 효과로 본문에 합류
  const handleAccept = useCallback(() => {
    if (!suggestion) return
    isAcceptingRef.current = true
    setShowSuggest(false)
    setShowTooltip(false)

    const text = (bodyRef.current.endsWith(' ') || bodyRef.current.endsWith('\n'))
      ? suggestion
      : ' ' + suggestion

    let i = 0
    const interval = setInterval(() => {
      if (i >= text.length) {
        clearInterval(interval)
        isAcceptingRef.current = false
        // 10초 쿨다운
        cooldownRef.current = true
        setTimeout(() => { cooldownRef.current = false }, 10000)
        scheduleAutosave()
        return
      }
      const char = text[i]
      i++
      setBody((prev) => {
        bodyRef.current = prev + char
        return prev + char
      })
    }, 40) // 글자당 40ms
  }, [suggestion, scheduleAutosave])

  // ── 이어쓰기 거절 ────────────────────────────────────────────
  const handleReject = useCallback(() => {
    clearSuggestion()
    // 쿨다운 재시작
    cooldownRef.current = true
    setTimeout(() => {
      cooldownRef.current = false
    }, 3000)
  }, [clearSuggestion])

  // ── 피드백 호출 ──────────────────────────────────────────────
  const handleFeedback = async () => {
    if (feedbackLoading) return
    setFeedbackOpen(true)
    setFeedbackText('')
    setFeedbackError(false)
    setFeedbackLoading(true)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: bodyRef.current }),
      })

      if (!res.ok) throw new Error()

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setFeedbackText((prev) => prev + decoder.decode(value))
      }
    } catch {
      setFeedbackError(true)
    } finally {
      setFeedbackLoading(false)
    }
  }

  // ── 뒤로가기 (복귀 분기) ────────────────────────────────────
  const handleBack = async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (body.trim()) await triggerSave()
    router.push(returnTo === 'archive' ? '/archive' : '/')
  }

  const handleTopicBlur = () => {
    setIsEditingTopic(false)
    if (body.trim()) scheduleAutosave()
  }

  const canFeedback = body.trim().length >= 50

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ maxWidth: '390px', margin: '0 auto' }}
    >
      {/* 헤더 — sticky */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white z-10 border-b border-zinc-50">
        <button
          onClick={handleBack}
          className="text-zinc-400 hover:text-zinc-800 transition-colors p-1"
          aria-label="뒤로가기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M19 12H5M5 12L11 18M5 12L11 6" />
          </svg>
        </button>
        <SaveIndicator status={saveStatus} />
      </header>

      {/* 자동저장 안내 — 새 글 첫 진입 시 3초 노출 */}
      {showAutoSaveTip && (
        <div className="px-5 pt-3">
          <p className="text-[12px] text-zinc-400 text-center">자동으로 저장돼요.</p>
        </div>
      )}

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto" ref={bodyContainerRef}>

        {/* 글감 — 스크롤 내려가면 자연스럽게 사라짐 */}
        {!isFree && (
          <div className="px-5 pt-6 pb-5">
            {isEditingTopic ? (
              <textarea
                autoFocus
                value={topicContent}
                onChange={(e) => setTopicContent(e.target.value)}
                onBlur={handleTopicBlur}
                rows={2}
                className="w-full text-[15px] font-medium text-zinc-800 leading-relaxed
                  bg-zinc-50 rounded-xl px-4 py-3 resize-none outline-none
                  border border-zinc-200 focus:border-zinc-400 transition-colors"
              />
            ) : (
              <button onClick={() => setIsEditingTopic(true)} className="w-full text-left">
                <p className="text-[15px] font-medium text-zinc-800 leading-snug">
                  {topicContent}
                </p>
              </button>
            )}
            <div className="mt-5 border-t border-zinc-100" />
          </div>
        )}

        {isFree && <div className="pt-6" />}

        {/* 본문 textarea */}
        <div className="px-5 relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              const newVal = e.target.value
              setBody(newVal)
              scheduleAutosave()
              // 타이핑 재개 → 제안 소멸
              if (showSuggest) clearSuggestion()
              schedulesuggestion()
            }}
            placeholder="떠오르는 장면부터 써봐요."
            className="w-full text-[15px] text-zinc-800 leading-[1.9] placeholder:text-zinc-300
              bg-transparent resize-none outline-none min-h-[55vh]"
          />

          {/* 이어쓰기 제안 텍스트 — 본문 바로 아래 */}
          {showSuggest && suggestion && (
            <p className="px-0 text-[15px] leading-[1.9] text-zinc-300 mt-[-4px] select-none">
              {suggestion}
            </p>
          )}
        </div>

        {/* 하단 여백 (툴바에 가리지 않도록) */}
        <div className="h-32" />
      </div>

      {/* ── 하단 툴바 — sticky ── */}
      <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-5 py-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* 이어쓰기 툴팁 (첫 등장 1회) */}
        {showTooltip && (
          <div
            className="absolute bottom-full left-5 right-5 mb-2 px-4 py-3
              bg-zinc-800 text-white rounded-xl text-[12px] leading-relaxed"
            onClick={() => setShowTooltip(false)}
          >
            AI가 다음 문장을 제안했어요. ✓ 수락 × 거절.
            <span className="text-zinc-400 ml-1">아카이브에서 끌 수 있어요.</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* 서식 버튼 */}
          <div className="flex items-center gap-1">
            <FormatButton
              label="B"
              bold
              onClick={() => insertFormat('**', textareaRef, setBody, scheduleAutosave)}
            />
            <FormatButton
              label="I"
              italic
              onClick={() => insertFormat('_', textareaRef, setBody, scheduleAutosave)}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* 이어쓰기 ✓ / × */}
            {showSuggest && (
              <>
                <button
                  onClick={handleReject}
                  className="w-8 h-8 flex items-center justify-center text-zinc-400
                    hover:text-zinc-700 transition-colors text-lg"
                  aria-label="제안 거절"
                >
                  ×
                </button>
                <button
                  onClick={handleAccept}
                  className="w-8 h-8 flex items-center justify-center text-zinc-600
                    hover:text-zinc-900 transition-colors text-lg"
                  aria-label="제안 수락"
                >
                  ✓
                </button>
              </>
            )}

            {/* ✦ 피드백 버튼 */}
            <button
              onClick={handleFeedback}
              disabled={!canFeedback}
              className="text-[13px] text-zinc-400 hover:text-zinc-700
                disabled:opacity-30 transition-colors"
            >
              ✦ 피드백
            </button>
          </div>
        </div>
      </div>

      {/* ── 피드백 바텀 시트 ── */}
      {feedbackOpen && (
        <>
          {/* 배경 dimming 없음 — 기획안 스펙 */}
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-30
              border-t border-zinc-100 overflow-hidden"
            style={{
              maxWidth: '390px',
              margin: '0 auto',
              height: `${sheetHeight}vh`,
              transition: 'height 0.3s ease',
            }}
          >
            {/* 드래그 핸들 */}
            <div
              className="flex justify-center pt-3 pb-2 cursor-pointer"
              onClick={() => setSheetHeight((h) => h === 40 ? 80 : 40)}
            >
              <div className="w-8 h-1 rounded-full bg-zinc-200" />
            </div>

            {/* 헤더 */}
            <div className="px-5 pb-3 flex items-center justify-between border-b border-zinc-50">
              <span className="text-[13px] font-medium text-zinc-700">✦ 피드백</span>
              <button
                onClick={() => setFeedbackOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-[18px] leading-none"
              >
                ×
              </button>
            </div>

            {/* 피드백 본문 */}
            <div className="px-5 py-4 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
              {feedbackError ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] text-zinc-500">
                    잠깐 문제가 생겼어요. 다시 시도해볼게요.
                  </p>
                  <button
                    onClick={handleFeedback}
                    className="text-[13px] text-zinc-400 hover:text-zinc-700 underline"
                  >
                    다시 시도
                  </button>
                </div>
              ) : feedbackLoading && !feedbackText ? (
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : (
                <p className="text-[14px] text-zinc-700 leading-[1.8] whitespace-pre-wrap">
                  {feedbackText}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 저장 상태 표시 ────────────────────────────────────────────
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  const map = {
    saving: { text: '저장 중...', cls: 'text-zinc-400' },
    saved:  { text: '✓ 저장됨',  cls: 'text-zinc-400' },
    error:  { text: '저장 실패', cls: 'text-red-400'  },
  }
  const { text, cls } = map[status]
  return <span className={`text-[12px] ${cls}`}>{text}</span>
}

// ── 서식 버튼 ─────────────────────────────────────────────────
function FormatButton({
  label, bold, italic, onClick,
}: {
  label: string; bold?: boolean; italic?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center text-zinc-400
        hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors text-sm"
      style={{ fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal' }}
    >
      {label}
    </button>
  )
}

// ── 볼드/이탤릭 삽입 ─────────────────────────────────────────
function insertFormat(
  marker: string,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  setBody: (v: string) => void,
  scheduleAutosave: () => void
) {
  const el = textareaRef.current
  if (!el) return

  const start = el.selectionStart
  const end   = el.selectionEnd
  const cur   = el.value
  let next: string
  let cursor: number

  if (start !== end) {
    const sel = cur.slice(start, end)
    next   = cur.slice(0, start) + marker + sel + marker + cur.slice(end)
    cursor = end + marker.length * 2
  } else {
    next   = cur.slice(0, start) + marker + marker + cur.slice(start)
    cursor = start + marker.length
  }

  setBody(next)
  scheduleAutosave()
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(cursor, cursor)
  })
}
