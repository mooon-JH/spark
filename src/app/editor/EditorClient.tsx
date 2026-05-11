'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveWriting } from '../actions/editor'
import type { WritingDraft } from '../actions/editor'

type Props = {
  userId: string
  topicId: string | null
  topicContent: string
  isFree: boolean
  draft: WritingDraft | null
  returnTo?: 'home' | 'archive'
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type FeedbackHighlight = {
  text: string
  type: 'positive' | 'negative'
  reason: string
  example?: string
}

type FeedbackData = {
  flow: string
  highlights: FeedbackHighlight[]
  next: string
}

export default function EditorClient({
  userId,
  topicId,
  topicContent: initialTopicContent,
  isFree,
  draft,
  returnTo = 'home',
}: Props) {
  const router = useRouter()

  const [writingId, setWritingId] = useState<string | null>(draft?.id ?? null)
  const [topicContent, setTopicContent] = useState(draft?.topic_content ?? initialTopicContent)
  const [body, setBody] = useState(draft?.body ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [showAutoSaveTip, setShowAutoSaveTip] = useState(!draft?.body)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!showAutoSaveTip) return
    const t = setTimeout(() => setShowAutoSaveTip(false), 1500)
    return () => clearTimeout(t)
  }, [showAutoSaveTip])

  // ── 이어쓰기 ────────────────────────────────────────────────
  const [suggestion, setSuggestion] = useState<string>('')
  const [showSuggest, setShowSuggest] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipShownRef = useRef(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownRef = useRef(false)
  const isAcceptingRef = useRef(false)

  // ── 피드백 ──────────────────────────────────────────────────
  const [feedbackMode, setFeedbackMode] = useState<'off' | 'scanning' | 'result'>('off')
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null)
  const [feedbackError, setFeedbackError] = useState(false)
  const [selectedHighlightIdx, setSelectedHighlightIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  // ── refs ────────────────────────────────────────────────────
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writingIdRef = useRef<string | null>(writingId)
  const bodyRef = useRef(body)
  const topicRef = useRef(topicContent)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editableRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { writingIdRef.current = writingId }, [writingId])
  useEffect(() => { bodyRef.current = body }, [body])
  useEffect(() => { topicRef.current = topicContent }, [topicContent])

  useEffect(() => {
    if (feedbackMode === 'off') {
      const el = textareaRef.current
      if (!el) return
      const len = el.value.length
      el.focus()
      el.setSelectionRange(len, len)
    }
  }, [feedbackMode])

  // ── 자동 저장 ───────────────────────────────────────────────
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

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (bodyRef.current.trim()) triggerSave()
    }
  }, [triggerSave])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  // ── 이어쓰기 API ─────────────────────────────────────────────
  const fetchSuggestion = useCallback(async () => {
    if (cooldownRef.current || isAcceptingRef.current) return
    if (!bodyRef.current.trim()) return
    if (feedbackMode !== 'off') return
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
      if (!tooltipShownRef.current) {
        tooltipShownRef.current = true
        setShowTooltip(true)
        setTimeout(() => setShowTooltip(false), 6000)
      }
    } catch { /* 무시 */ }
  }, [feedbackMode])

  const scheduleSuggestion = useCallback(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(fetchSuggestion, 3500)
  }, [fetchSuggestion])

  const clearSuggestion = useCallback(() => {
    setShowSuggest(false)
    setSuggestion('')
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
  }, [])

  const handleAccept = useCallback(() => {
    if (!suggestion) return
    isAcceptingRef.current = true
    setShowSuggest(false)
    setShowTooltip(false)

    const prefix = bodyRef.current.endsWith(' ') || bodyRef.current.endsWith('\n') ? '' : ' '
    const text = prefix + suggestion

    let i = 0
    const interval = setInterval(() => {
      if (i >= text.length) {
        clearInterval(interval)
        isAcceptingRef.current = false
        cooldownRef.current = true
        setTimeout(() => { cooldownRef.current = false }, 10000)
        scheduleAutosave()
        return
      }
      const char = text[i]
      i++
      setBody((prev) => {
        const next = prev + char
        bodyRef.current = next
        return next
      })
    }, 60)
  }, [suggestion, scheduleAutosave])

  const handleReject = useCallback(() => {
    clearSuggestion()
    cooldownRef.current = true
    setTimeout(() => { cooldownRef.current = false }, 3000)
  }, [clearSuggestion])

  // ── 피드백 ──────────────────────────────────────────────────
  const handleFeedback = async () => {
    if (feedbackMode !== 'off') return
    clearSuggestion()
    setFeedbackMode('scanning')
    setFeedbackData(null)
    setFeedbackError(false)
    setSelectedHighlightIdx(null)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: bodyRef.current }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.error) throw new Error()

      await new Promise((resolve) => setTimeout(resolve, 2000))
      setFeedbackData(data)
      setFeedbackMode('result')
    } catch {
      setFeedbackError(true)
      setFeedbackMode('off')
    }
  }

  const handleCloseFeedback = () => {
    setFeedbackMode('off')
    setFeedbackData(null)
    setSelectedHighlightIdx(null)
  }

  const handleHighlightClick = (idx: number) => {
    if (selectedHighlightIdx === idx) {
      setSelectedHighlightIdx(null)
      setEditText('')
    } else {
      setSelectedHighlightIdx(idx)
      const hl = feedbackData?.highlights[idx]
      setEditText(hl?.text ?? '')
    }
  }

  const handleApplyEdit = () => {
    if (selectedHighlightIdx === null || !feedbackData) return
    const hl = feedbackData.highlights[selectedHighlightIdx]
    const newBody = body.replace(hl.text, editText)
    setBody(newBody)
    bodyRef.current = newBody
    scheduleAutosave()

    const updatedHighlights = [...feedbackData.highlights]
    updatedHighlights[selectedHighlightIdx] = { ...hl, text: editText }
    setFeedbackData({ ...feedbackData, highlights: updatedHighlights })

    setSelectedHighlightIdx(null)
    setEditText('')
  }

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

  // ── 하이라이트된 원문 렌더링 ─────────────────────────────────
  const renderBody = () => {
    if (feedbackMode === 'off') {
      // 일반 모드 — textarea
      return (
        <>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              const v = e.target.value
              setBody(v)
              bodyRef.current = v
              scheduleAutosave()
              clearSuggestion()
              scheduleSuggestion()
            }}
            placeholder="떠오르는 장면부터 써봐요..."
            className="w-full text-[15px] text-zinc-700 leading-[1.8] resize-none focus:outline-none bg-transparent"
            style={{ minHeight: '60vh' }}
          />

          {showAutoSaveTip && (
            <div className="mt-2 text-xs text-zinc-400">자동으로 저장돼요.</div>
          )}

          {showSuggest && (
            <div className="relative mt-2">
              <div className="flex items-start gap-2">
                <span className="text-[15px] text-zinc-400 leading-[1.8]">{suggestion}</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={handleAccept}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-bold"
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleReject}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
              {showTooltip && (
                <div className="absolute -top-8 left-0 bg-zinc-900 text-white text-[11px] px-2 py-1 rounded whitespace-nowrap">
                  ✓ 수락 · × 거절
                </div>
              )}
            </div>
          )}
        </>
      )
    }

    // 피드백 모드 — 하이라이트 + 인라인 상세
    if (!feedbackData) return null

    // 원문을 줄 단위로 나눔
    const lines = body.split('\n')
    const result: JSX.Element[] = []

    lines.forEach((line, lineIdx) => {
      if (!line.trim()) {
        result.push(<div key={`line-${lineIdx}`} className="h-[1.8em]" />)
        return
      }

      // 이 줄에 있는 하이라이트 찾기
      const lineHighlights = feedbackData.highlights
        .map((hl, hlIdx) => ({ ...hl, hlIdx }))
        .filter((hl) => line.includes(hl.text))

      if (lineHighlights.length === 0) {
        // 하이라이트 없음
        result.push(
          <div key={`line-${lineIdx}`} className="text-[15px] text-zinc-700 leading-[1.8]">
            {line}
          </div>
        )
      } else {
        // 하이라이트 있음 — 분할해서 렌더링
        let remaining = line
        const segments: JSX.Element[] = []

        lineHighlights.forEach((hl, idx) => {
          const pos = remaining.indexOf(hl.text)
          if (pos === -1) return

          // 앞부분 텍스트
          if (pos > 0) {
            segments.push(
              <span key={`before-${idx}`} className="text-zinc-700">
                {remaining.slice(0, pos)}
              </span>
            )
          }

          // 하이라이트
          const isPositive = hl.type === 'positive'
          const isSelected = selectedHighlightIdx === hl.hlIdx
          segments.push(
            <span
              key={`hl-${hl.hlIdx}`}
              onClick={() => handleHighlightClick(hl.hlIdx)}
              className="cursor-pointer inline-block px-1 rounded transition-shadow"
              style={{
                backgroundColor: isPositive ? '#dcfce7' : '#fef9c3',
                color: isPositive ? '#166534' : '#713f12',
                boxShadow: isSelected
                  ? `0 0 0 2px ${isPositive ? '#166534' : '#713f12'}`
                  : 'none',
              }}
            >
              <span className="text-[10px] mr-0.5">{isPositive ? '✓' : '→'}</span>
              {hl.text}
            </span>
          )

          remaining = remaining.slice(pos + hl.text.length)
        })

        // 나머지 텍스트
        if (remaining) {
          segments.push(
            <span key="after" className="text-zinc-700">
              {remaining}
            </span>
          )
        }

        result.push(
          <div key={`line-${lineIdx}`} className="text-[15px] leading-[1.8]">
            {segments}
          </div>
        )

        // 선택된 하이라이트의 상세 정보 (해당 줄 바로 아래)
        lineHighlights.forEach((hl) => {
          if (selectedHighlightIdx === hl.hlIdx) {
            const isPositive = hl.type === 'positive'
            result.push(
              <div
                key={`detail-${hl.hlIdx}`}
                className="mt-2 mb-4 flex flex-col gap-2 animate-slideDown"
              >
                {/* 이유 */}
                <div className="bg-zinc-50 border-l-2 border-zinc-400 px-3 py-2 rounded-r-lg">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                    이유
                  </p>
                  <p className="text-xs text-zinc-700 leading-relaxed">{hl.reason}</p>
                </div>

                {/* 예시 (negative만) */}
                {!isPositive && hl.example && (
                  <div className="bg-amber-50 border-l-2 border-amber-400 px-3 py-2 rounded-r-lg">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
                      예시
                    </p>
                    <p className="text-xs text-zinc-700 leading-relaxed italic">
                      {hl.example}
                    </p>
                  </div>
                )}

                {/* 수정창 (negative만) */}
                {!isPositive && (
                  <div className="flex flex-col gap-2 bg-white border border-zinc-200 rounded-lg p-3">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="수정할 문장을 입력하세요"
                      className="w-full text-sm text-zinc-900 bg-transparent border-b border-zinc-200 pb-1 focus:outline-none focus:border-zinc-900"
                    />
                    <button
                      onClick={handleApplyEdit}
                      className="self-end px-3 py-1.5 bg-zinc-900 text-white text-xs rounded-lg hover:bg-zinc-700"
                    >
                      반영
                    </button>
                  </div>
                )}
              </div>
            )
          }
        })
      }
    })

    return <div className="flex flex-col">{result}</div>
  }

  const isInFeedbackMode = feedbackMode !== 'off'
  const containerBorder = isInFeedbackMode ? 'border-zinc-900' : 'border-zinc-200'
  const headerBg = isInFeedbackMode ? 'bg-zinc-900' : 'bg-white'

  return (
    <div
      className={`min-h-screen bg-white transition-opacity duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* 헤더 */}
      <header
        className={`sticky top-0 z-20 ${headerBg} transition-colors duration-300`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-[390px] mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={handleBack}
            className={`p-2 -ml-2 transition-colors ${
              isInFeedbackMode ? 'text-white' : 'text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            {feedbackMode === 'scanning' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white">글을 읽고 있어요</span>
                <div className="flex gap-1">
                  <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {feedbackMode === 'result' && (
              <button
                onClick={handleCloseFeedback}
                className="px-3 py-1.5 text-xs text-white border border-white/20 rounded-lg hover:bg-white/10"
              >
                종료
              </button>
            )}

            {feedbackMode === 'off' && <SaveIndicator status={saveStatus} />}
          </div>
        </div>
      </header>

      {/* 본문 */}
      <div className="max-w-[390px] mx-auto">
        <div className={`min-h-[calc(100vh-3.5rem)] border-x ${containerBorder} transition-colors duration-300 relative`}>
          {/* 글감 */}
          <div className="px-4 pt-6 pb-6">
            {isEditingTopic || (isFree && !topicContent.trim()) ? (
              <input
                type="text"
                value={topicContent}
                onChange={(e) => setTopicContent(e.target.value)}
                onBlur={handleTopicBlur}
                placeholder={isFree ? '제목을 입력하세요' : ''}
                autoFocus={isFree && !topicContent.trim()}
                className="w-full text-[15px] font-semibold text-zinc-900 bg-transparent border-b border-zinc-300 pb-1 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-400"
              />
            ) : (
              <button
                onClick={() => setIsEditingTopic(true)}
                className="w-full text-left text-[15px] font-semibold text-zinc-900 hover:text-zinc-600"
              >
                {topicContent}
              </button>
            )}
          </div>

          {/* 피드백 구조 배너 */}
          {feedbackMode === 'result' && feedbackData && (
            <div className="px-4 pb-4">
              <div className="bg-zinc-50 border-l-2 border-zinc-900 px-3 py-2 rounded-r-lg">
                <p className="text-xs text-zinc-700 leading-relaxed">{feedbackData.flow}</p>
              </div>
            </div>
          )}

          {/* 스캔 오버레이 */}
          {feedbackMode === 'scanning' && (
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{ backdropFilter: 'blur(2px)', backgroundColor: 'rgba(255,255,255,0.6)' }}
            >
              <div
                className="h-1 bg-gradient-to-r from-transparent via-zinc-900/30 to-transparent"
                style={{ animation: 'scan 2s ease-in-out infinite' }}
              />
            </div>
          )}

          {/* 본문 영역 */}
          <div className="px-4 pb-20">{renderBody()}</div>

          {/* 다음 시도 */}
          {feedbackMode === 'result' && feedbackData && (
            <div className="px-4 pb-6">
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                  다음에 시도해볼 것
                </p>
                <p className="text-xs text-zinc-700 leading-relaxed">{feedbackData.next}</p>
              </div>
            </div>
          )}

          {/* 하단 고정 */}
          <div
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 z-30"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="max-w-[390px] mx-auto px-4 py-3">
              {feedbackMode === 'off' && (
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <FormatButton label="B" bold onClick={() => insertFormat('**', textareaRef, setBody, scheduleAutosave)} />
                    <FormatButton label="I" italic onClick={() => insertFormat('*', textareaRef, setBody, scheduleAutosave)} />
                  </div>
                  <button
                    onClick={handleFeedback}
                    disabled={!canFeedback || feedbackMode !== 'off'}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      canFeedback && feedbackMode === 'off'
                        ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    {feedbackMode === 'scanning' ? '읽는 중...' : '✦ 피드백'}
                  </button>
                </div>
              )}

              {feedbackError && (
                <div className="text-center">
                  <p className="text-xs text-zinc-500 mb-2">잠깐 문제가 생겼어요. 다시 시도해볼게요.</p>
                  <button onClick={handleFeedback} className="text-xs text-zinc-400 underline">
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(calc(100vh - 14rem)); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  const map = {
    saving: { text: '저장 중...', cls: 'text-zinc-400' },
    saved: { text: '✓ 저장됨', cls: 'text-zinc-400' },
    error: { text: '저장 실패', cls: 'text-red-400' },
  }
  const { text, cls } = map[status]
  return <span className={`text-xs ${cls}`}>{text}</span>
}

function FormatButton({ label, bold, italic, onClick }: { label: string; bold?: boolean; italic?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors text-sm"
      style={{ fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal' }}
    >
      {label}
    </button>
  )
}

function insertFormat(
  marker: string,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  setBody: (v: string) => void,
  scheduleAutosave: () => void
) {
  const el = textareaRef.current
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const cur = el.value
  let next: string
  let cursor: number
  if (start !== end) {
    const sel = cur.slice(start, end)
    next = cur.slice(0, start) + marker + sel + marker + cur.slice(end)
    cursor = end + marker.length * 2
  } else {
    next = cur.slice(0, start) + marker + marker + cur.slice(start)
    cursor = start + marker.length
  }
  setBody(next)
  scheduleAutosave()
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(cursor, cursor)
  })
}
