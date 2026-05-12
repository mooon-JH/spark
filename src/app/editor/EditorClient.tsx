'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ReactElement } from 'react'
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

type ReferenceMemo = {
  id: string
  content: string
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
  // body: HTML 저장 (굵기/이탤릭 포함), bodyText: 순수 텍스트 (API 전송 · 피드백 매칭용)
  const [body, setBody] = useState(draft?.body ?? '')
  const [bodyText, setBodyText] = useState(draft?.body ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [showAutoSaveTip, setShowAutoSaveTip] = useState(!draft?.body)
  const [mounted, setMounted] = useState(false)

  // 글자 크기
  const [fontSize, setFontSize] = useState(16)

  // 키보드 높이 감지 (iOS Safari 대응)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  // 참고 메모
  const [referenceMemos, setReferenceMemos] = useState<ReferenceMemo[]>([])

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!showAutoSaveTip) return
    const t = setTimeout(() => setShowAutoSaveTip(false), 1500)
    return () => clearTimeout(t)
  }, [showAutoSaveTip])

  // ── iOS Safari 키보드 감지 ──────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const vv = window.visualViewport
    if (!vv) return

    const handleViewportChange = () => {
      // 키보드 높이 = 전체 화면 높이 - 실제 보이는 높이
      const height = window.innerHeight - vv.height
      
      // 150px 이상일 때만 키보드로 판단 (주소창 등 제외)
      setKeyboardHeight(height > 150 ? height : 0)
    }

    vv.addEventListener('resize', handleViewportChange)
    vv.addEventListener('scroll', handleViewportChange)

    return () => {
      vv.removeEventListener('resize', handleViewportChange)
      vv.removeEventListener('scroll', handleViewportChange)
    }
  }, [])

  // ── 이어쓰기 ────────────────────────────────────────────────
  const [suggestion, setSuggestion] = useState<string>('')
  const [showSuggest, setShowSuggest] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isFetchingSuggest, setIsFetchingSuggest] = useState(false)
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
  const [showFeedbackHint, setShowFeedbackHint] = useState(false)

  // ── refs ────────────────────────────────────────────────────
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writingIdRef = useRef<string | null>(writingId)
  const bodyRef = useRef(body)         // HTML
  const bodyTextRef = useRef(bodyText) // 순수 텍스트
  const topicRef = useRef(topicContent)
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { writingIdRef.current = writingId }, [writingId])
  useEffect(() => { bodyRef.current = body }, [body])
  useEffect(() => { bodyTextRef.current = bodyText }, [bodyText])
  useEffect(() => { topicRef.current = topicContent }, [topicContent])

  // contentEditable 초기 콘텐츠 설정 (마운트 시 1회)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.innerHTML = draft?.body ?? ''
    // 커서를 끝으로
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(el)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
    el.focus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (feedbackMode === 'off') {
      const el = editorRef.current
      if (!el) return
      el.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
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

  // ── 이어쓰기 API ─────────────────────────────────────────────
  const fetchSuggestion = useCallback(async () => {
    if (cooldownRef.current || isAcceptingRef.current) return
    if (!bodyTextRef.current.trim()) return
    if (feedbackMode !== 'off') return

    setIsFetchingSuggest(true)

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: bodyTextRef.current }), // 순수 텍스트 전송
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
    } catch { /* 무시 */ } finally {
      setIsFetchingSuggest(false)
    }
  }, [feedbackMode])

  const scheduleSuggestion = useCallback(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(fetchSuggestion, 3500)
  }, [fetchSuggestion])

  const clearSuggestion = useCallback(() => {
    setShowSuggest(false)
    setSuggestion('')
    setIsFetchingSuggest(false)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
  }, [])

  const handleAccept = useCallback(() => {
    if (!suggestion) return
    isAcceptingRef.current = true
    setShowSuggest(false)
    setShowTooltip(false)

    const el = editorRef.current
    if (!el) return

    // 커서를 콘텐츠 끝으로 이동
    el.focus()
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(el)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)

    const prefix = bodyTextRef.current.endsWith(' ') || bodyTextRef.current.endsWith('\n') ? '' : ' '
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
      // execCommand로 커서 위치에 한 글자씩 삽입 → onInput 이벤트 자동 발생
      document.execCommand('insertText', false, text[i])
      i++
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
        body: JSON.stringify({ body: bodyTextRef.current }), // 순수 텍스트 전송
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
    // bodyText(순수 텍스트)에서 교체 후 editor에 반영
    const newText = bodyTextRef.current.replace(hl.text, editText)
    const el = editorRef.current
    if (el) {
      el.innerText = newText          // 서식은 초기화되지만 텍스트 정확히 반영
      bodyRef.current = el.innerHTML
      bodyTextRef.current = newText
      setBody(el.innerHTML)
      setBodyText(newText)
    }
    scheduleAutosave()

    const updatedHighlights = [...feedbackData.highlights]
    updatedHighlights[selectedHighlightIdx] = { ...hl, text: editText }
    setFeedbackData({ ...feedbackData, highlights: updatedHighlights })

    setSelectedHighlightIdx(null)
    setEditText('')
  }

  // ── 참고 메모 ───────────────────────────────────────────────
  const handleAddReference = () => {
    if (!feedbackData?.next) return
    const newMemo: ReferenceMemo = {
      id: Date.now().toString(),
      content: feedbackData.next,
    }
    setReferenceMemos([...referenceMemos, newMemo])
    
    // 피드백 모드 종료해서 본문에 메모가 보이도록
    setFeedbackMode('off')
    setFeedbackData(null)
    setSelectedHighlightIdx(null)
  }

  const handleDeleteMemo = (id: string) => {
    setReferenceMemos(referenceMemos.filter(m => m.id !== id))
  }

  // ── 피드백 버튼 비활성 안내 ────────────────────────────────
  const handleFeedbackButtonTap = () => {
    if (!canFeedback) {
      setShowFeedbackHint(true)
      setTimeout(() => setShowFeedbackHint(false), 2000)
      return
    }
    handleFeedback()
  }

  // ── 글자 크기 조절 ──────────────────────────────────────────
  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(14, prev - 2))
  }

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(18, prev + 2))
  }

  const handleBack = async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (body.trim()) await triggerSave()
    router.push(returnTo === 'archive' ? '/archive' : '/')
  }

  const handleTopicBlur = () => {
    setIsEditingTopic(false)
    if (bodyTextRef.current.trim()) scheduleAutosave()
  }

  // contentEditable 입력 핸들러
  const handleEditorInput = () => {
    const el = editorRef.current
    if (!el) return
    const html = el.innerHTML
    const text = el.innerText
    setBody(html)
    setBodyText(text)
    bodyRef.current = html
    bodyTextRef.current = text
    scheduleAutosave()
    clearSuggestion()
    scheduleSuggestion()
  }

  // 서식 — execCommand로 선택 텍스트에 즉시 반영
  const handleBold = () => {
    document.execCommand('bold')
    editorRef.current?.focus()
  }
  const handleItalic = () => {
    document.execCommand('italic')
    editorRef.current?.focus()
  }

  const canFeedback = bodyText.trim().length >= 50

  // ── 하이라이트된 원문 렌더링 ─────────────────────────────────
  const renderBody = () => {
    if (feedbackMode === 'off') {
      return (
        <>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            data-placeholder="떠오르는 장면부터 써봐요..."
            className="w-full text-zinc-700 leading-[1.8] focus:outline-none bg-transparent editor-content"
            style={{
              fontSize: `${fontSize}px`,
              minHeight: '50vh',
              paddingBottom: keyboardHeight > 0 ? '80px' : '120px',
              wordBreak: 'break-word',
            }}
          />

          {showAutoSaveTip && (
            <div className="mt-2 text-xs text-zinc-400">자동으로 저장돼요.</div>
          )}

          {/* 이어쓰기 로딩 */}
          {isFetchingSuggest && !showSuggest && (
            <div className="mt-2 flex items-center gap-2 text-zinc-400">
              <div className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs">다음 문장 제안 중...</span>
            </div>
          )}

          {/* 이어쓰기 제안 */}
          {showSuggest && (
            <div className="relative mt-2">
              <div className="flex items-start gap-2">
                <span className="text-zinc-400 leading-[1.8]" style={{ fontSize: `${fontSize}px`, fontStyle: 'italic' }}>{suggestion}</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={handleAccept}
                    className="min-w-[44px] min-h-[44px] w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-sm font-bold"
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleReject}
                    className="min-w-[44px] min-h-[44px] w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-sm font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
              {showTooltip && (
                <div className="absolute -top-10 left-0 bg-zinc-900 text-white text-[11px] px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
                  ✓ 수락 · × 거절
                </div>
              )}
            </div>
          )}

          {/* 참고 메모 */}
          {referenceMemos.map(memo => (
            <div
              key={memo.id}
              className="relative my-4 bg-blue-50 border border-blue-200 rounded-lg p-3"
              style={{ borderStyle: 'dashed' }}
            >
              <button
                onClick={() => handleDeleteMemo(memo.id)}
                className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-600"
                style={{ fontSize: '24px' }}
              >
                ×
              </button>
              <div className="text-[12px] text-blue-700 font-medium mb-1">
                📝 참고 메모
              </div>
              <div 
                contentEditable
                suppressContentEditableWarning
                className="text-[14px] text-zinc-700 leading-relaxed outline-none pr-10"
                style={{ fontSize: `${Math.max(14, fontSize - 2)}px` }}
              >
                {memo.content}
              </div>
            </div>
          ))}
        </>
      )
    }

    // 피드백 모드
    if (!feedbackData) return null

    // 피드백 모드: 순수 텍스트 기준으로 매칭 (HTML 태그 영향 없음)
    const plainText = bodyTextRef.current
    const matchedHighlights = feedbackData.highlights.filter((hl) =>
      plainText.includes(hl.text)
    )

    const lines = plainText.split('\n')
    const result: ReactElement[] = []

    lines.forEach((line, lineIdx) => {
      if (!line.trim()) {
        result.push(<div key={`line-${lineIdx}`} className="h-[1.8em]" />)
        return
      }

      const lineHighlights = matchedHighlights
        .map((hl, hlIdx) => ({ ...hl, hlIdx }))
        .filter((hl) => line.includes(hl.text))

      if (lineHighlights.length === 0) {
        result.push(
          <div key={`line-${lineIdx}`} className="text-zinc-700 leading-[1.8]" style={{ fontSize: `${fontSize}px` }}>
            {line}
          </div>
        )
      } else {
        let remaining = line
        const segments: ReactElement[] = []

        lineHighlights.forEach((hl, idx) => {
          const pos = remaining.indexOf(hl.text)
          if (pos === -1) return

          if (pos > 0) {
            segments.push(
              <span key={`before-${idx}`} className="text-zinc-700">
                {remaining.slice(0, pos)}
              </span>
            )
          }

          const isPositive = hl.type === 'positive'
          const isSelected = selectedHighlightIdx === hl.hlIdx
          segments.push(
            <span
              key={`hl-${hl.hlIdx}`}
              onClick={() => handleHighlightClick(hl.hlIdx)}
              className="cursor-pointer px-1 rounded transition-shadow"
              style={{
                display: 'inline',
                fontSize: `${fontSize}px`,
                lineHeight: '1.8',
                backgroundColor: isPositive ? '#dcfce7' : '#fef9c3',
                color: isPositive ? '#166534' : '#713f12',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
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

        if (remaining) {
          segments.push(
            <span key="after" className="text-zinc-700">
              {remaining}
            </span>
          )
        }

        result.push(
          <div key={`line-${lineIdx}`} className="leading-[1.8]" style={{ fontSize: `${fontSize}px` }}>
            {segments}
          </div>
        )

        // 선택된 하이라이트 상세
        lineHighlights.forEach((hl) => {
          if (selectedHighlightIdx === hl.hlIdx) {
            const isPositive = hl.type === 'positive'
            
            result.push(
              <div
                key={`detail-${hl.hlIdx}`}
                className="mt-2 mb-4 flex flex-col gap-2 animate-slideDown"
              >
                <div className="bg-zinc-50 border-l-2 border-zinc-400 px-3 py-2 rounded-r-lg">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                    이유
                  </p>
                  <p className="text-xs text-zinc-700 leading-relaxed">{hl.reason}</p>
                </div>

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

                {!isPositive && (
                  <div className="flex flex-col gap-2 bg-white border border-zinc-200 rounded-lg p-3">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="수정할 문장을 입력하세요"
                      autoFocus
                      className="w-full text-zinc-900 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-900"
                      style={{ fontSize: `${fontSize}px` }}
                    />
                    <button
                      onClick={handleApplyEdit}
                      className="self-end min-h-[44px] px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
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
      className={`flex flex-col bg-white transition-opacity duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ 
        height: '100dvh',
      }}
    >
      <header
        className={`flex-none sticky top-0 z-20 ${headerBg} transition-colors duration-300`}
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="w-full px-4 h-14 flex items-center justify-between">
          {/* 뒤로가기 - 피드백 모드가 아닐 때만 표시 */}
          {feedbackMode === 'off' && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 min-w-[44px] min-h-[44px] transition-colors text-zinc-400 hover:text-zinc-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* 피드백 모드일 때는 빈 공간 */}
          {feedbackMode !== 'off' && <div className="w-10" />}

          <div className="flex items-center gap-3">
            {feedbackMode === 'result' && (
              <button
                onClick={handleCloseFeedback}
                className="min-h-[44px] px-3 py-1.5 text-xs text-white border border-white/20 rounded-lg hover:bg-white/10 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>닫기</span>
              </button>
            )}

            {feedbackMode === 'off' && <SaveIndicator status={saveStatus} />}
          </div>
        </div>
      </header>

      {/* 본문 영역 - 독립 스크롤 */}
      <div className="flex-1 overflow-y-auto">
        <div className={`min-h-full border-x ${containerBorder} transition-colors duration-300 relative`}>
          {/* 제목 */}
          <div className="px-4 pt-6 pb-4">
            {isEditingTopic || (isFree && !topicContent.trim()) ? (
              <input
                type="text"
                value={topicContent}
                onChange={(e) => setTopicContent(e.target.value)}
                onBlur={handleTopicBlur}
                placeholder={isFree ? '제목을 입력하세요' : ''}
                autoFocus={isFree && !topicContent.trim()}
                className="w-full font-semibold text-zinc-900 bg-transparent border-b border-zinc-300 pb-1 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-400"
                style={{ fontSize: `${fontSize}px` }}
              />
            ) : (
              <button
                onClick={() => setIsEditingTopic(true)}
                className="w-full text-left font-semibold text-zinc-900 hover:text-zinc-600 min-h-[44px]"
                style={{ fontSize: `${fontSize}px` }}
              >
                {topicContent}
              </button>
            )}
          </div>

          {/* 제목/본문 구분선 */}
          <div className="px-4 pb-4">
            <div className="h-px bg-zinc-100" />
          </div>

          {/* 스캔 오버레이 */}
          {feedbackMode === 'scanning' && (
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{ 
                backdropFilter: 'blur(2px)', 
                backgroundColor: 'rgba(255,255,255,0.6)',
                top: 0
              }}
            >
              <div className="absolute top-20 left-0 right-0 flex justify-center">
                <div className="bg-zinc-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg">
                  피드백을 위해 글을 분석하고 있어요
                </div>
              </div>
              
              <div
                className="h-1 bg-gradient-to-r from-transparent via-zinc-900/30 to-transparent"
                style={{ animation: 'scan 2s ease-in-out infinite' }}
              />
            </div>
          )}

          {/* 피드백 구조 배너 */}
          {feedbackMode === 'result' && feedbackData && (
            <div className="px-4 pb-4">
              <div className="bg-amber-50 border-l-2 border-amber-500 px-3 py-2.5 rounded-r-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">💡</span>
                  <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                    글 흐름 파악
                  </p>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed">{feedbackData.flow}</p>
              </div>
            </div>
          )}

          {/* 본문 */}
          <div className="px-4 pb-32">{renderBody()}</div>

          {/* 피드백 제안 박스 */}
          {feedbackMode === 'result' && feedbackData && (
            <div className="px-4 pb-6">
              <div className="bg-blue-50 border-l-2 border-blue-500 rounded-r-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">✍️</span>
                  <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wide">
                    이렇게 써보면 어떨까요?
                  </p>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed mb-2">{feedbackData.next}</p>
                <button
                  onClick={handleAddReference}
                  className="min-h-[44px] px-3 py-1.5 text-xs text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  📝 아래에 추가하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 하단 툴바 - 키보드 위로 자동 이동 */}
      {feedbackMode === 'off' && (
        <div
          className="flex-none bg-white border-t border-zinc-100 z-30"
          style={{
            bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
            paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
            transition: 'bottom 0.15s ease-out',
            position: 'relative',
          }}
        >
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleBold() }}
                  className="min-w-[44px] min-h-[44px] w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors text-sm font-bold"
                >
                  B
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleItalic() }}
                  className="min-w-[44px] min-h-[44px] w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors text-sm italic"
                >
                  I
                </button>
                <div className="h-5 w-px bg-zinc-200 mx-1" />
                <button
                  onClick={decreaseFontSize}
                  className="min-w-[44px] min-h-[44px] w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                >
                  −
                </button>
                <span className="text-sm text-zinc-500 w-6 text-center">{fontSize}</span>
                <button
                  onClick={increaseFontSize}
                  className="min-w-[44px] min-h-[44px] w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                >
                  +
                </button>
              </div>
              <div className="relative">
                {showFeedbackHint && (
                  <div className="absolute -top-10 right-0 bg-zinc-800 text-white text-[11px] px-3 py-1.5 rounded-lg whitespace-nowrap shadow-md">
                    50자 이상 쓰면 활성화돼요
                  </div>
                )}
                <button
                  onClick={handleFeedbackButtonTap}
                  disabled={feedbackMode !== 'off'}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    canFeedback && feedbackMode === 'off'
                      ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                      : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  ✦ 피드백
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {feedbackError && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
          <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-lg text-center">
            <p className="text-xs text-zinc-500 mb-2">잠깐 문제가 생겼어요. 다시 시도해볼게요.</p>
            <button onClick={handleFeedback} className="text-xs text-zinc-400 underline min-h-[44px]">
              다시 시도
            </button>
          </div>
        </div>
      )}

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
        /* contentEditable placeholder */
        .editor-content:empty::before {
          content: attr(data-placeholder);
          color: rgb(212 212 216);
          pointer-events: none;
          display: block;
        }
        /* 에디터 서식 렌더링 */
        .editor-content b,
        .editor-content strong { font-weight: 700; }
        .editor-content i,
        .editor-content em { font-style: italic; }
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

