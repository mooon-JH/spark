'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveWriting } from '../actions/editor'
import type { WritingDraft } from '../actions/editor'

type Props = {
  userId: string
  topicId: string | null
  topicContent: string
  firstSentence: string
  isFree: boolean
  draft: WritingDraft | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function EditorClient({
  userId,
  topicId,
  topicContent: initialTopicContent,
  firstSentence,
  isFree,
  draft,
}: Props) {
  const router = useRouter()

  const [writingId, setWritingId] = useState<string | null>(draft?.id ?? null)
  const [topicContent, setTopicContent] = useState(
    draft?.topic_content ?? initialTopicContent
  )
  const [body, setBody] = useState(draft?.body ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [showRestoreBanner, setShowRestoreBanner] = useState(
    !!draft?.body && draft.body.length > 0
  )

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writingIdRef = useRef<string | null>(writingId)
  const bodyRef = useRef(body)
  const topicRef = useRef(topicContent)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => { writingIdRef.current = writingId }, [writingId])
  useEffect(() => { bodyRef.current = body }, [body])
  useEffect(() => { topicRef.current = topicContent }, [topicContent])

  // 자동 저장
  const triggerSave = useCallback(async () => {
    if (!bodyRef.current.trim()) return
    setSaveStatus('saving')

    const result = await saveWriting({
      writingId: writingIdRef.current,
      userId,
      topicId,
      topicContent: topicRef.current,
      firstSentence,
      body: bodyRef.current,
    })

    if ('error' in result) {
      setSaveStatus('error')
    } else {
      setWritingId(result.id)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [userId, topicId, firstSentence])

  // 디바운스: 타이핑 멈추고 1.5초 후 저장
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

  // textarea 높이 자동 조절
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  const handleBack = async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (body.trim()) await triggerSave()
    router.push('/')
  }

  const handleTopicBlur = () => {
    setIsEditingTopic(false)
    if (body.trim()) scheduleAutosave()
  }

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ paddingTop: '59px', paddingBottom: '34px', maxWidth: '390px', margin: '0 auto' }}
    >
      {/* 헤더 */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-white z-10 border-b border-zinc-50">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M19 12H5M5 12L11 18M5 12L11 6" />
          </svg>
        </button>
        <SaveIndicator status={saveStatus} />
      </header>

      {/* 임시저장 복원 배너 */}
      {showRestoreBanner && (
        <div className="mx-5 mt-4 px-4 py-3 bg-zinc-50 rounded-xl flex items-center justify-between">
          <span className="text-[12px] text-zinc-500">이어서 작성하고 있어요</span>
          <button
            onClick={() => setShowRestoreBanner(false)}
            className="text-[11px] text-zinc-400 hover:text-zinc-700"
          >
            닫기
          </button>
        </div>
      )}

      {/* 글감 / 자유 주제 헤더 */}
      <div className="px-5 mt-6 mb-5">
        {isFree ? (
          <p className="text-[13px] text-zinc-400">자유 주제</p>
        ) : isEditingTopic ? (
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
            <p className="text-[15px] font-medium text-zinc-800 leading-relaxed">
              {topicContent}
            </p>
            <span className="text-[11px] text-zinc-300 mt-1 block">탭하여 글감 수정</span>
          </button>
        )}
      </div>

      {/* 구분선 */}
      <div className="mx-5 border-t border-zinc-100 mb-5" />

      {/* 첫 문장 */}
      {firstSentence && !isFree && (
        <div className="px-5 mb-4">
          <p className="text-[14px] text-zinc-400 leading-relaxed italic">
            {firstSentence}
          </p>
        </div>
      )}

      {/* 본문 */}
      <div className="px-5 flex-1">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            scheduleAutosave()
          }}
          placeholder={isFree ? '자유롭게 써내려가세요...' : '여기서부터 써내려가세요...'}
          className="w-full text-[15px] text-zinc-800 leading-[1.8] placeholder:text-zinc-300
            bg-transparent resize-none outline-none min-h-[50vh]"
          style={{ fontFamily: 'var(--font-geist-sans)' }}
        />
      </div>

      {/* 서식 툴바 */}
      <div className="sticky bottom-[34px] px-5 py-3 bg-white border-t border-zinc-100 flex gap-3">
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
    </div>
  )
}

// ── 저장 상태 ─────────────────────────────────────────────────
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
      className="w-8 h-8 flex items-center justify-center text-zinc-500
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
  const end = el.selectionEnd
  const current = el.value

  let next: string
  let newCursor: number

  if (start !== end) {
    const selected = current.slice(start, end)
    next = current.slice(0, start) + marker + selected + marker + current.slice(end)
    newCursor = end + marker.length * 2
  } else {
    next = current.slice(0, start) + marker + marker + current.slice(start)
    newCursor = start + marker.length
  }

  setBody(next)
  scheduleAutosave()

  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(newCursor, newCursor)
  })
}
