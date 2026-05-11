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

  // ── 기본 상태 ───────────────────────────────────────────────
  const [writingId, setWritingId] = useState<string | null>(draft?.id ?? null)
  const [topicContent, setTopicContent] = useState(draft?.topic_content ?? initialTopicContent)
  const [body, setBody] = useState(draft?.body ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [showAutoSaveTip, setShowAutoSaveTip] = useState(!draft?.body)
  const [mounted, setMounted] = useState(false)

  // 진입 애니메이션
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  // 자동저장 안내 1.5초 후 소멸
  useEffect(() => {
    if (!showAutoSaveTip) return
    const t = setTimeout(() => setShowAutoSaveTip(false), 1500)
    return () => clearTimeout(t)
  }, [showAutoSaveTip])

  // ── 이어쓰기 상태 ────────────────────────────────────────────
  const [suggestion, setSuggestion] = useState<string>('')
  const [showSuggest, setShowSuggest] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipShownRef = useRef(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownRef = useRef(false)
  const isAcceptingRef = useRef(false)

  // ── 피드백 상태 ──────────────────────────────────────────────
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

  useEffect(() => {
    writingIdRef.current = writingId
  }, [writingId])
  useEffect(() => {
    bodyRef.current = body
  }, [body])
  useEffect(() => {
    topicRef.current = topicContent
  }, [topicContent])

  // 에디터 진입 시 커서 자동 포커스
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const len = el.value.length
    el.focus()
    el.setSelectionRange(len, len)
  }, [])

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

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (bodyRef.current.trim()) triggerSave()
    }
  }, [triggerSave])

  // textarea 높이 자동 조절
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  // ── 이어쓰기 API 호출 ────────────────────────────────────────
  const fetchSuggestion = useCallback(async () => {
    if (cooldownRef.current || isAcceptingRef.current) return
    if (!bodyRef.current.trim()) return
    if (feedbackMode !== 'off') return // 피드백 모드에서는 이어쓰기 중지
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
      // 첫 등장 툴팁 — 6초 노출
      if (!tooltipShownRef.current) {
        tooltipShownRef.current = true
        setShowTooltip(true)
        setTimeout(() => setShowTooltip(false), 6000)
      }
    } catch {
      /* 조용히 무시 */
    }
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

  // ── 이어쓰기 수락 — 한 글자씩 타이핑 효과 ──────────────────
  const handleAccept = useCallback(() => {
    if (!suggestion) return
    isAcceptingRef.current = true
    setShowSuggest(false)
    setShowTooltip(false)

    const prefix =
      bodyRef.current.endsWith(' ') || bodyRef.current.endsWith('\n') ? '' : ' '
    const text = prefix + suggestion

    let i = 0
    const interval = setInterval(() => {
      if (i >= text.length) {
        clearInterval(interval)
        isAcceptingRef.current = false
        cooldownRef.current = true
        setTimeout(() => {
          cooldownRef.current = false
        }, 10000)
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

  // ── 이어쓰기 거절 ────────────────────────────────────────────
  const handleReject = useCallback(() => {
    clearSuggestion()
    cooldownRef.current = true
    setTimeout(() => {
      cooldownRef.current = false
    }, 3000)
  }, [clearSuggestion])

  // ── 피드백 ──────────────────────────────────────────────────
  const handleFeedback = async () => {
    if (feedbackMode !== 'off') return
    clearSuggestion() // 이어쓰기 제거
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
      
      // 스캔 완료 → 결과 표시
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 최소 2초 스캔 효과
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
    setSelectedHighlightIdx(null)
    setEditText('')
  }

  // ── 뒤로가기 ────────────────────────────────────────────────
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

  // ── 피드백 모드 스타일 ──────────────────────────────────────
  const isInFeedbackMode = feedbackMode !== 'off'
  const containerBorder = isInFeedbackMode ? 'border-zinc-900' : 'border-zinc-200'
  const headerBg = isInFeedbackMode ? 'bg-zinc-900' : 'bg-white'
  const headerText = isInFeedbackMode ? 'text-white' : 'text-zinc-700'

  return (
    <div
      className={`min-h-screen bg-white transition-opacity duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* 헤더 */}
      <header
        className={`sticky top-0 z-20 ${headerBg} transition-colors duration-300`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="max-w-[390px] mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={handleBack}
            className={`p-2 -ml-2 transition-colors ${
              isInFeedbackMode ? 'text-white' : 'text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            {feedbackMode === 'scanning' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white">글을 읽고 있어요</span>
                <div className="flex gap-1">
                  <span
                    className="w-1 h-1 rounded-full bg-white animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-1 h-1 rounded-full bg-white animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-1 h-1 rounded-full bg-white animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}

            {feedbackMode === 'result' && (
              <button
                onClick={handleCloseFeedback}
                className="px-3 py-1.5 text-xs text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
              >
                종료
              </button>
            )}

            {feedbackMode === 'off' && <SaveIndicator status={saveStatus} />}
          </div>
        </div>
      </header>

      {/* 본문 컨테이너 */}
      <div className="max-w-[390px] mx-auto">
        <div
          className={`min-h-[calc(100vh-3.5rem)] border-x ${containerBorder} transition-colors duration-300`}
        >
          {/* 글감 */}
          <div className="px-4 pt-6 pb-4">
            {isEditingTopic ? (
              <input
                type="text"
                value={topicContent}
                onChange={(e) => setTopicContent(e.target.value)}
                onBlur={handleTopicBlur}
                autoFocus
                className="w-full text-[15px] font-medium text-zinc-900 bg-transparent border-b border-zinc-300 pb-1 focus:outline-none focus:border-zinc-500"
              />
            ) : (
              <button
                onClick={() => setIsEditingTopic(true)}
                className="w-full text-left text-[15px] font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
              >
                {topicContent}
              </button>
            )}
          </div>

          {/* 스캔 애니메이션 오버레이 */}
          {feedbackMode === 'scanning' && (
            <div className="relative">
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.05) 100%)',
                  backdropFilter: 'blur(2px)',
                  opacity: 0.45,
                }}
              >
                <div
                  className="h-1 bg-gradient-to-r from-transparent via-zinc-900/30 to-transparent animate-scan"
                  style={{
                    animation: 'scan 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* 피드백 결과 — 구조 배너 */}
          {feedbackMode === 'result' && feedbackData && (
            <div className="px-4 pb-3">
              <div
                className="bg-zinc-50 border-l-2 border-zinc-900 px-3 py-2 rounded-r-lg"
              >
                <p className="text-xs text-zinc-700 leading-relaxed">{feedbackData.flow}</p>
              </div>
            </div>
          )}

          {/* 본문 textarea */}
          <div className="px-4 pb-20">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => {
                const v = e.target.value
                setBody(v)
                bodyRef.current = v
                scheduleAutosave()
                clearSuggestion()
                if (feedbackMode === 'off') {
                  scheduleSuggestion()
                }
              }}
              placeholder="떠오르는 장면부터 써봐요..."
              className="w-full text-[15px] text-zinc-900 leading-[1.8] resize-none focus:outline-none bg-transparent"
              style={{
                minHeight: '60vh',
              }}
            />

            {/* 자동저장 안내 */}
            {showAutoSaveTip && (
              <div className="mt-2 text-xs text-zinc-400">자동으로 저장돼요.</div>
            )}

            {/* 이어쓰기 제안 */}
            {showSuggest && feedbackMode === 'off' && (
              <div className="relative mt-2">
                <div className="flex items-start gap-2">
                  <span className="text-[15px] text-zinc-400 leading-[1.8]">
                    {suggestion}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={handleAccept}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-bold transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleReject}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-bold transition-colors"
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

            {/* 피드백 하이라이트 표시 */}
            {feedbackMode === 'result' && feedbackData && (
              <div className="mt-6 flex flex-col gap-3">
                <p className="text-xs text-zinc-500">문장을 탭해보세요</p>
                {feedbackData.highlights.map((hl, idx) => {
                  const isPositive = hl.type === 'positive'
                  const bgColor = isPositive ? '#dcfce7' : '#fef9c3'
                  const textColor = isPositive ? '#166534' : '#713f12'
                  const badge = isPositive ? '✓' : '→'
                  const isSelected = selectedHighlightIdx === idx

                  return (
                    <div key={idx} className="flex flex-col gap-2">
                      {/* 하이라이트 문장 */}
                      <button
                        onClick={() => handleHighlightClick(idx)}
                        className="text-left"
                      >
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-sm leading-relaxed"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                          }}
                        >
                          <span className="text-[10px]">{badge}</span>
                          <span>{hl.text}</span>
                        </span>
                      </button>

                      {/* 상세 정보 */}
                      {isSelected && (
                        <div className="flex flex-col gap-1.5 animate-slideDown">
                          {/* 이유 */}
                          <div className="bg-zinc-50 border-l-2 border-zinc-400 px-3 py-2 rounded-r-lg">
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                              이유
                            </p>
                            <p className="text-xs text-zinc-700 leading-relaxed">
                              {hl.reason}
                            </p>
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
                                className="self-end px-3 py-1.5 bg-zinc-900 text-white text-xs rounded-lg hover:bg-zinc-700 transition-colors"
                              >
                                반영
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* 다음 시도 */}
                <div className="mt-4 bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                    다음에 시도해볼 것
                  </p>
                  <p className="text-xs text-zinc-700 leading-relaxed">
                    {feedbackData.next}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 하단 고정 영역 */}
          <div
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 z-30"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="max-w-[390px] mx-auto px-4 py-3">
              {feedbackMode === 'off' && (
                <div className="flex items-center justify-between">
                  {/* 서식 툴바 */}
                  <div className="flex gap-1">
                    <FormatButton
                      label="B"
                      bold
                      onClick={() =>
                        insertFormat('**', textareaRef, setBody, scheduleAutosave)
                      }
                    />
                    <FormatButton
                      label="I"
                      italic
                      onClick={() =>
                        insertFormat('*', textareaRef, setBody, scheduleAutosave)
                      }
                    />
                  </div>

                  {/* 피드백 버튼 */}
                  <button
                    onClick={handleFeedback}
                    disabled={!canFeedback || feedbackError}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      canFeedback
                        ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    ✦ 피드백
                  </button>
                </div>
              )}

              {feedbackError && (
                <div className="text-center">
                  <p className="text-xs text-zinc-500 mb-2">
                    잠깐 문제가 생겼어요. 다시 시도해볼게요.
                  </p>
                  <button
                    onClick={handleFeedback}
                    className="text-xs text-zinc-400 underline"
                  >
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

function FormatButton({
  label,
  bold,
  italic,
  onClick,
}: {
  label: string
  bold?: boolean
  italic?: boolean
  onClick: () => void
}) {
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
